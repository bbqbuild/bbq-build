// Gemini integration: real-product search (Google-grounded), build validation,
// and the chat assistant that edits designs via structured operations.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

function apiKey() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server'), { status: 503 })
  return key
}

async function callGemini({ contents, systemInstruction, tools, responseSchema, temperature = 0.4, maxOutputTokens = 2048 }) {
  const body = {
    contents,
    generationConfig: { temperature, maxOutputTokens },
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

/** Lenient JSON extraction — models occasionally wrap JSON in fences or truncate. */
function parseJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    // salvage a truncated response: at each '}' from the end, try closing the
    // operations array + root object (or just the root) and parse.
    for (let i = trimmed.length - 1; i > 0; i--) {
      if (trimmed[i] !== '}') continue
      const prefix = trimmed.slice(0, i + 1)
      for (const suffix of [']}', '}', ']}}']) {
        try {
          return JSON.parse(prefix + suffix)
        } catch {
          /* try next */
        }
      }
    }
    console.error('parseJson failed. len=', trimmed.length, 'tail=', JSON.stringify(trimmed.slice(-120)))
    throw new Error('Gemini returned malformed JSON')
  }
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
    maxOutputTokens: 4096,
  })

  const { items } = parseJson(structured.text)
  const cleaned = (items ?? [])
    .filter((i) => i.width_cm > 10 && i.width_cm < 250 && i.price_usd > 0)
    .slice(0, 8)
  searchCache.set(key, { at: Date.now(), items: cleaned })
  return { items: cleaned, cached: false }
}

// ---------- scan a product URL ----------

async function scanUrl(url) {
  let html = ''
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bbq.build/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    html = await res.text()
  } catch (e) {
    throw Object.assign(new Error(`Couldn't open that URL (${e.message}). Paste a public product page.`), { status: 400 })
  }
  // crude HTML → text, keep title/meta and body text
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 6000)

  const structured = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Extract the outdoor-kitchen appliance from this product page as JSON. ` +
              `Category must be one of: ${CATEGORIES.join(', ')}. width_cm is the unit's width (cut-out width if given, else overall). ` +
              `If it's not an outdoor kitchen appliance, set category to "" .\n\nTITLE: ${title}\nURL: ${url}\nPAGE: ${text}`,
          },
        ],
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        model: { type: 'string' },
        category: { type: 'string' },
        width_cm: { type: 'number' },
        price_usd: { type: 'number' },
        blurb: { type: 'string' },
      },
      required: ['brand', 'model', 'category', 'width_cm', 'price_usd', 'blurb'],
    },
    temperature: 0.1,
    maxOutputTokens: 1024,
  })
  const item = parseJson(structured.text)
  if (!item.category || !CATEGORIES.includes(item.category)) {
    throw Object.assign(new Error("That page doesn't look like an outdoor-kitchen appliance we can place."), { status: 422 })
  }
  item.url = url
  return { item }
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
    maxOutputTokens: 2048,
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
              'add_run',
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
          run: { type: 'string', enum: ['back', 'left', 'right', 'island'], description: 'add_frame/add_run/move_frame target run' },
          units: {
            type: 'array',
            description: 'add_run: the frames to build in this run, left to right',
            items: {
              type: 'object',
              properties: {
                width: { type: 'number', description: '40|60|80|90' },
                lowered: { type: 'boolean', description: 'smoker table for a kamado' },
                top: { type: 'string', description: 'counter-level appliance typeId (optional)' },
                base: { type: 'string', description: 'under-counter appliance typeId (optional)' },
              },
              required: ['width'],
            },
          },
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
      'You are the bbq.build design assistant. You edit an outdoor-kitchen design by emitting a SHORT list of operations (usually 3-12; never repeat operations). ' +
      'Frames are modules (40/60/80/90 cm); each has a top slot (counter level) and a base slot (under counter). frameIndex is 0-based in the FLAT design.frames array. ' +
      'Shape = design.layout: straight | l-left | l-right | u. design.island toggles a front island row. Each frame has a run: back (default), left, right, or island. ' +
      'Rules: (1) set_layout / set_island BEFORE adding wing/island frames. (2) Every add_frame for a wing MUST carry run:"left"/"right"; island frames MUST carry run:"island"; back frames omit run. Never leave wing/island frames on the back. ' +
      '(3) Each operation object is complete: place_appliance carries BOTH frameIndex AND typeId; add_frame carries width (+run for wings). ' +
      '(4) A frame added at the end of its run gets frameIndex = current design.frames length. (5) Islands hold bar seating — add island frames when the user wants seats. ' +
      '(6) Kamados (egg-xl, primo-xl) need lowered:true frames. (7) No refrigeration under heat; sink-40 needs a doors/trash base; respect minFrameWidth. ' +
      'PREFER add_run to build a whole run at once: {op:"add_run", run, units:[{width, top?, base?, lowered?}]}. This is the reliable way to fill wings and islands. ' +
      'Example (empty design → "L kitchen with a grill and a 2-seat island"): operations = ' +
      '[{op:set_layout,layout:l-right},{op:set_island,island:true},' +
      '{op:add_run,run:back,units:[{width:90,top:santamaria-90,base:doors-60},{width:60,top:sink-40,base:doors-60}]},' +
      '{op:add_run,run:right,units:[{width:60,base:fridge-60}]},' +
      '{op:add_run,run:island,units:[{width:90},{width:60}]}]. ' +
      `APPLIANCE CATALOG (use these typeIds only):\n${catalogSummary}\n` +
      'Return a short friendly "reply" plus the operations. Do NOT invent typeIds.',
    contents,
    responseSchema: CHAT_SCHEMA,
    temperature: 0.35,
    maxOutputTokens: 3072,
  })
  const result = parseJson(text)
  // safety net: drop runaway repeated add_frame loops the model sometimes emits
  if (Array.isArray(result.operations)) {
    const cleaned = []
    let repeat = 0
    let prev = ''
    for (const op of result.operations) {
      const sig = JSON.stringify(op)
      repeat = sig === prev ? repeat + 1 : 0
      prev = sig
      if (op.op === 'add_frame' && repeat >= 2) continue // 3rd+ identical add_frame → skip
      cleaned.push(op)
      if (cleaned.length >= 18) break
    }
    result.operations = cleaned
  }
  return result
}

module.exports = { searchAppliances, validateBuild, chat, scanUrl }
