// Gemini integration: real-product search (Google-grounded), build validation,
// and the chat assistant that edits designs via structured operations.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

function apiKey() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server'), { status: 503 })
  return key
}

async function callGemini({ contents, systemInstruction, tools, responseSchema, temperature = 0.4 }) {
  const body = {
    contents,
    generationConfig: { temperature },
  }
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] }
  if (tools) body.tools = tools
  if (responseSchema) {
    body.generationConfig.responseMimeType = 'application/json'
    body.generationConfig.responseSchema = responseSchema
  }
  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    const err = new Error(`Gemini error ${res.status}: ${text.slice(0, 300)}`)
    err.status = res.status === 429 ? 429 : 502
    throw err
  }
  const data = await res.json()
  const cand = data.candidates?.[0]
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  if (!text) throw Object.assign(new Error('Gemini returned an empty response'), { status: 502 })
  return { text, grounded: Boolean(cand?.groundingMetadata) }
}

/** Lenient JSON extraction — models occasionally wrap JSON in fences. */
function parseJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(trimmed)
}

// ---------- real product search ----------

const CATEGORIES = [
  'grill',
  'santamaria',
  'kamado',
  'griddle',
  'burner',
  'sink',
  'icebin',
  'pizza',
  'fridge',
  'kegerator',
  'icemaker',
  'drawers',
  'doors',
  'trash',
  'woodstore',
]

const searchCache = new Map() // query -> {at, items}
const SEARCH_TTL = 1000 * 60 * 60 * 24

async function searchAppliances(query) {
  const key = query.toLowerCase().trim()
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.at < SEARCH_TTL) return { items: hit.items, cached: true }

  // Pass 1: grounded research
  const research = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Find up to 6 real, currently sold outdoor-kitchen appliances matching: "${query}". ` +
              `For each: brand, exact model name, physical/cut-out width in cm, approximate US price in USD, ` +
              `product category, one-line description, and the manufacturer or retailer product URL. ` +
              `Prefer built-in / drop-in models that install into outdoor kitchen islands.`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.2,
  })

  // Pass 2: structure it
  const structured = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Convert these research notes into JSON. Categories must be one of: ${CATEGORIES.join(', ')}. ` +
              `(santamaria = open argentine grills, kamado = ceramic eggs/smokers, icebin = drop-in ice bins/coolers, ` +
              `woodstore = firewood storage, drawers/doors/trash = storage units.) ` +
              `width_cm is the unit's width (use cut-out width if known). Skip items you cannot categorize.\n\n${research.text}`,
          },
        ],
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              brand: { type: 'string' },
              model: { type: 'string' },
              category: { type: 'string', enum: CATEGORIES },
              width_cm: { type: 'number' },
              price_usd: { type: 'number' },
              url: { type: 'string' },
              blurb: { type: 'string' },
            },
            required: ['brand', 'model', 'category', 'width_cm', 'price_usd', 'blurb'],
          },
        },
      },
      required: ['items'],
    },
    temperature: 0.1,
  })

  const { items } = parseJson(structured.text)
  const cleaned = (items ?? [])
    .filter((i) => i.width_cm > 10 && i.width_cm < 250 && i.price_usd > 0)
    .slice(0, 8)
  searchCache.set(key, { at: Date.now(), items: cleaned })
  return { items: cleaned, cached: false }
}

// ---------- build validation ----------

async function validateBuild(design, catalogSummary) {
  const { text } = await callGemini({
    systemInstruction:
      'You are a master outdoor-kitchen designer and installer reviewing a build spec. ' +
      'Judge real-world feasibility: clearances around heat appliances, ventilation of gas units in enclosed islands, ' +
      'refrigeration near heat, plumbing/drain needs for sinks and ice makers, electrical needs, combustible-material risks, ' +
      'workflow (cook/prep/wet zones), counter overhang and landing space beside grills, and structural sanity. ' +
      'Use web search when a specific product spec matters. Be concrete and terse; no fluff.',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Review this outdoor kitchen design and report issues.\n\nDESIGN (units cm):\n${JSON.stringify(design, null, 1)}\n\n` +
              `CATALOG REFERENCE:\n${catalogSummary}\n\n` +
              `Respond ONLY with JSON: {"feasible": boolean, "score": number (0-100 build-quality), ` +
              `"summary": string (2 sentences), "issues": [{"severity": "error"|"warning"|"info", "message": string}], ` +
              `"suggestions": [string]}. Max 6 issues, max 4 suggestions.`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.3,
  })
  return parseJson(text)
}

// ---------- chat assistant ----------

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Short conversational answer to the user (1-3 sentences).' },
    operations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: {
            type: 'string',
            enum: [
              'add_frame',
              'remove_frame',
              'place_appliance',
              'remove_appliance',
              'set_ground',
              'set_finish',
              'set_frame_lowered',
              'set_layout',
              'set_island',
              'move_frame',
              'set_name',
              'clear',
            ],
          },
          width: { type: 'number', description: 'add_frame: 40|60|80|90' },
          lowered: { type: 'boolean' },
          layout: { type: 'string', enum: ['straight', 'l-left', 'l-right', 'u'] },
          island: { type: 'boolean' },
          run: { type: 'string', enum: ['back', 'left', 'right', 'island'], description: 'add_frame/move_frame target run' },
          index: { type: 'number', description: 'insertion index for add_frame / target for move_frame' },
          frameIndex: { type: 'number', description: '0-based index into design.frames' },
          toIndex: { type: 'number' },
          typeId: { type: 'string' },
          zone: { type: 'string', enum: ['top', 'base'] },
          groundType: { type: 'string', enum: ['deck', 'concrete', 'pavers', 'stone'] },
          groundWidth: { type: 'number' },
          finish: { type: 'string', enum: ['graphite', 'steel', 'teak', 'stone'] },
          name: { type: 'string' },
        },
        required: ['op'],
      },
    },
  },
  required: ['reply', 'operations'],
}

async function chat(messages, design, catalogSummary) {
  const contents = messages.slice(-14).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  contents.push({
    role: 'user',
    parts: [
      {
        text:
          `CURRENT DESIGN STATE (do not repeat to the user, units cm):\n${JSON.stringify(design)}\n\n` +
          `Respond to my last message above by returning JSON per the schema: a short "reply" plus "operations" ` +
          `that edit the design. Use empty operations for pure questions.`,
      },
    ],
  })
  const { text } = await callGemini({
    systemInstruction:
      'You are the bbq.build design assistant. You edit an outdoor-kitchen design by emitting operations; the app applies them. ' +
      'Frames are modules (40/60/80/90 cm wide); each has a top slot (counter level) and a base slot (under counter). ' +
      'The kitchen has a shape (design.layout): straight, l-left, l-right (an extra perpendicular wing joined by a corner), or u (two wings). ' +
      'design.island adds a freestanding island row in front. Frames live in a run: back (default), left, right, or island (frame.run field). ' +
      'Use set_layout {layout} / set_island {island} to change shape, and add_frame {width, run} to build wings. ' +
      'A run only shows if the layout includes it — set the layout BEFORE adding frames to a wing. frameIndex always indexes the FLAT design.frames array. ' +
      'CRITICAL for shaped kitchens: EVERY add_frame that belongs to a wing MUST include run:"left"/"right", and island frames MUST include run:"island". ' +
      'A frame with no run goes to the back counter. So for an L with an island, some frames carry run:"left" (or "right") and others run:"island" — never leave them all on the back. ' +
      'Example — L-right with a grill on the back and a 2-seat island:\n' +
      '{"reply":"An L-shaped kitchen with a grill and a bar island.","operations":[' +
      '{"op":"set_layout","layout":"l-right"},{"op":"set_island","island":true},' +
      '{"op":"add_frame","width":90},{"op":"place_appliance","frameIndex":0,"typeId":"grill-90"},' +
      '{"op":"add_frame","width":60,"run":"right"},{"op":"place_appliance","frameIndex":1,"typeId":"fridge-60"},' +
      '{"op":"add_frame","width":90,"run":"island"},{"op":"add_frame","width":60,"run":"island"}]}\n' +
      'Islands are where bar seating goes — add island frames when the user wants seats/stools. ' +
      'Kamado smokers (egg-xl, primo-xl) need a frame with lowered=true (smoker table). ' +
      'Placement rules the app enforces: appliance minFrameWidth must fit the frame; no refrigeration (fridge-60, kegerator-60, icemaker-60) ' +
      'directly under heat (grill-90, grill-80, santamaria-90, griddle-60, burner-40); no woodstore-40 under heat; sink-40 requires doors/trash base; ' +
      'lowered frames take only kamados on top and woodstore-40/drawers-40 in the base. ' +
      `APPLIANCE CATALOG:\n${catalogSummary}\n` +
      'frameIndex is 0-based in current design.frames order. When the user asks for something that needs a wider frame than exists, ' +
      'add a suitable frame first, then place into it (operations run in order; a frame added at the end has index = previous length). ' +
      'CRITICAL: every operation object must be complete and self-contained — place_appliance always carries BOTH frameIndex AND typeId ' +
      'in the same object; add_frame always carries width. Never split one action across two objects. ' +
      'Example — user says "grill island with a fridge" on an empty design:\n' +
      '{"reply":"Done — a 90 cm grill with doors below and a fridge beside it.","operations":[' +
      '{"op":"add_frame","width":90},' +
      '{"op":"place_appliance","frameIndex":0,"typeId":"grill-90"},' +
      '{"op":"place_appliance","frameIndex":0,"typeId":"doors-60"},' +
      '{"op":"add_frame","width":60},' +
      '{"op":"place_appliance","frameIndex":1,"typeId":"fridge-60"}]}\n' +
      'Be concise and friendly; never invent typeIds outside the catalog.',
    contents,
    responseSchema: CHAT_SCHEMA,
    temperature: 0.5,
  })
  return parseJson(text)
}

module.exports = { searchAppliances, validateBuild, chat }
