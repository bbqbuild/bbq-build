// Gemini integration: real-product search (Google-grounded), build validation,
// and the chat assistant that edits designs via structured operations.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

function apiKey() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server'), { status: 503 })
  return key
}

async function callGemini({ contents, systemInstruction, tools, responseSchema, temperature = 0.4, maxOutputTokens = 2048, thinkingBudget }) {
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
  // Gemini 2.5 "thinking" consumes the output-token budget and can truncate a
  // structured JSON reply mid-object. For deterministic extraction we don't need
  // reasoning, so disable it (thinkingBudget: 0) and give the JSON the whole budget.
  if (thinkingBudget !== undefined) {
    body.generationConfig.thinkingConfig = { thinkingBudget }
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
    thinkingBudget: 0,
  })

  const { items } = parseJson(structured.text)
  const cleaned = (items ?? [])
    .filter((i) => i.width_cm > 10 && i.width_cm < 250 && i.price_usd > 0)
    .slice(0, 8)
  searchCache.set(key, { at: Date.now(), items: cleaned })
  return { items: cleaned, cached: false }
}

// ---------- scan a product URL ----------

// Real browser headers — many retailers (bbqguys, Home Depot, etc.) 403 a
// bare fetch. This gets us through most of them.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Not:A-Brand";v="99"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
}

/** Turn a product URL slug into readable words for a fallback search. */
function slugWords(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter((p) => p && !/^\d+$/.test(p) && p.length > 2)
    return parts.slice(-2).join(' ').replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').trim()
  } catch {
    return url
  }
}

async function scanUrl(url) {
  let html = ''
  let fetchErr = ''
  try {
    const res = await fetch(url, { redirect: 'follow', headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15000) })
    if (!res.ok) fetchErr = `fetch ${res.status}`
    else html = await res.text()
  } catch (e) {
    fetchErr = e.message
  }

  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim()
  let text
  let sourceNote = ''

  if (html) {
    // Structured data first — most retailers embed the product's
    // name/brand/price/dimensions in JSON-LD or og:/meta tags. These carry
    // the real specs; the visible body is mostly nav chrome.
    const jsonld = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1].trim())
      .filter((s) => /"@type"\s*:\s*"?Product/i.test(s) || /"offers"|"price"|"brand"/i.test(s))
      .join('\n')
      .slice(0, 5000)
    const metas = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](og:[^"']+|description|twitter:[^"']+)["'][^>]*content=["']([^"']*)["']/gi)]
      .map((m) => `${m[1]}: ${m[2]}`)
      .join('\n')
      .slice(0, 1500)
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 3500)
    text = [
      jsonld && `STRUCTURED DATA (JSON-LD):\n${jsonld}`,
      metas && `META TAGS:\n${metas}`,
      `PAGE TEXT:\n${body}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  } else {
    // The site blocked our fetch (403/anti-bot) — fall back to a grounded web
    // search so we can still identify the product from its URL.
    const product = slugWords(url)
    const research = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `Look up the real outdoor-kitchen appliance sold at this product page: ${url}\n` +
                `The product appears to be: "${product}". ` +
                `Report the brand, exact model name/number, physical or cut-out width in cm, current US price in USD, ` +
                `product category, and a one-line description. If the page is unreachable, use the product name to find it.`,
            },
          ],
        },
      ],
      tools: [{ google_search: {} }],
      temperature: 0.2,
    })
    if (!research.text) {
      throw Object.assign(
        new Error(`Couldn't open that URL (${fetchErr || 'blocked'}) and couldn't find it. Try the manufacturer's page.`),
        { status: 400 },
      )
    }
    text = `WEB RESEARCH (the retailer page could not be fetched directly):\n${research.text}`
    sourceNote = ' The page could not be fetched; use the web-research notes below.'
  }

  const structured = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Extract the outdoor-kitchen appliance from this product page as JSON. ` +
              `Category must be one of: ${CATEGORIES.join(', ')}. ` +
              `(santamaria = open argentine/gaucho grills, kamado = ceramic eggs/smokers, icebin = drop-in ice bins.) ` +
              `Give ALL dimensions in centimeters (convert from inches; 1 in = 2.54 cm). Prefer the CUT-OUT ` +
              `(installation opening) dimensions when listed — cutout_width_cm, cutout_height_cm, cutout_depth_cm — ` +
              `otherwise the overall dimensions. width_cm = cutout_width_cm. price_usd is the listed price. ` +
              `blurb is ONE short sentence. If it's not an outdoor kitchen appliance, set category to "".` +
              `${sourceNote}\n\nTITLE: ${title}\nURL: ${url}\n\n${text}`,
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
        cutout_width_cm: { type: 'number' },
        cutout_height_cm: { type: 'number' },
        cutout_depth_cm: { type: 'number' },
        price_usd: { type: 'number' },
        blurb: { type: 'string' },
      },
      required: ['brand', 'model', 'category', 'width_cm', 'price_usd', 'blurb'],
    },
    temperature: 0.1,
    maxOutputTokens: 2048,
    thinkingBudget: 0,
  })
  const item = parseJson(structured.text)
  if (!item.category || !CATEGORIES.includes(item.category)) {
    throw Object.assign(new Error("That page doesn't look like an outdoor-kitchen appliance we can place."), { status: 422 })
  }
  // fold cutout dims into the item (width_cm stays the primary sizing width)
  if (item.cutout_width_cm > 0) item.width_cm = item.cutout_width_cm
  item.height_cm = item.cutout_height_cm || item.height_cm || 0
  item.depth_cm = item.cutout_depth_cm || item.depth_cm || 0
  item.url = url
  return { item }
}

// ---------- build validation ----------

async function validateBuild(design, catalogSummary) {
  // Pass 1: grounded expert review as free text. (Gemini can't combine a
  // response schema with the google_search tool, so we structure in pass 2.)
  const review = await callGemini({
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
              `Review this outdoor kitchen design. Give an overall feasibility verdict, a 0-100 build-quality score, ` +
              `a two-sentence summary, up to 6 concrete issues (each tagged error/warning/info), and up to 4 suggestions.\n\n` +
              `DESIGN (units cm):\n${JSON.stringify(design, null, 1)}\n\nCATALOG REFERENCE:\n${catalogSummary}`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.3,
    maxOutputTokens: 2048,
  })

  // Pass 2: structure the review into strict JSON (schema → always valid).
  const { text } = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [{ text: `Convert this outdoor-kitchen build review into JSON.\n\n${review.text}` }],
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        feasible: { type: 'boolean' },
        score: { type: 'number' },
        summary: { type: 'string' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['error', 'warning', 'info'] },
              message: { type: 'string' },
            },
            required: ['severity', 'message'],
          },
        },
        suggestions: { type: 'array', items: { type: 'string' } },
      },
      required: ['feasible', 'score', 'summary', 'issues', 'suggestions'],
    },
    temperature: 0.1,
    maxOutputTokens: 2048,
    thinkingBudget: 0,
  })
  return parseJson(text)
}

// ---------- DIY project planner ----------

/**
 * Clarifying questions for a DIY build of one kitchen section. Fast schema-only
 * call — the answers feed diyPlan.
 */
async function diyQuestions(section) {
  const { text } = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `A homeowner wants to DIY-build this SECTION of a steel-stud outdoor kitchen (frames = modular steel-stud ` +
              `cabinets skinned with cement board; appliances drop into cutouts). Ask the 3-5 most important clarifying ` +
              `questions you need to produce an exact build plan — think utilities available (gas/water/electric and where ` +
              `from), countertop material preference, exterior finish, foundation/surface, local climate, and skill/tools ` +
              `they already own. Never ask about things already specified.\n\nSECTION:\n${JSON.stringify(section, null, 1)}`,
          },
        ],
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              q: { type: 'string' },
              hint: { type: 'string', description: 'example answer / what to consider' },
            },
            required: ['id', 'q'],
          },
        },
      },
      required: ['questions'],
    },
    temperature: 0.3,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
  })
  return parseJson(text)
}

/** Full DIY plan: grounded research pass (real appliance specs/weights) → strict schema. */
async function diyPlan(section, answers) {
  const research = await callGemini({
    systemInstruction:
      'You are a master outdoor-kitchen builder writing an exact DIY plan for ONE section of a modular steel-stud ' +
      'outdoor kitchen (galvanized steel studs + tracks, cement board sheathing, waterproofing, finish, stone counter, ' +
      'drop-in appliances). Use web search to find the REAL specs of the named appliances — exact cutout dimensions, ' +
      'WEIGHT (critical for structure: e.g. a Primo XL or ceramic kamado is very heavy and needs a reinforced lowered ' +
      'table), ventilation requirements for gas units, and utility needs (gas line size, GFCI circuits, water supply/drain). ' +
      'Be concrete: quantities, sizes, real product types, realistic US prices.',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Write the full DIY build plan for this section. Include: a materials shopping list with quantities and ` +
              `estimated costs; the complete tool list (marking optional ones); structural notes driven by the actual ` +
              `appliance weights and cutouts; utility rough-ins (gas/water/drain/electric) needed by these exact ` +
              `appliances; countertop recommendation (material, thickness, overhang, cutouts) honoring the user's ` +
              `preference; ordered build steps with durations; and safety notes (venting, clearances to combustibles). ` +
              `Every step lists ITS OWN tools and 3-6 IKEA-simple exact actions. ` +
              `CRITICAL: express every measurement in the homeowner's preferred_units (see the section data) — sizes, ` +
              `lengths, thicknesses, overhangs, weights, everything.\n\n` +
              `SECTION (cm units):\n${JSON.stringify(section, null, 1)}\n\n` +
              `HOMEOWNER ANSWERS:\n${JSON.stringify(answers ?? {}, null, 1)}`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.3,
    maxOutputTokens: 4096,
  })

  const { text } = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Convert this DIY outdoor-kitchen build plan into JSON. Keep quantities/costs concrete. ` +
              `steps get ids s1,s2,…; keep at most 14 steps, 25 materials, 15 tools.\n\n${research.text}`,
          },
        ],
      },
    ],
    responseSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '2-3 sentence overview of the project' },
        skill_level: { type: 'string', description: 'e.g. Beginner-friendly / Intermediate / Advanced' },
        est_days: { type: 'number' },
        total_est_cost_usd: { type: 'number' },
        structure_notes: { type: 'array', items: { type: 'string' } },
        utilities: {
          type: 'array',
          items: {
            type: 'object',
            properties: { type: { type: 'string' }, requirement: { type: 'string' } },
            required: ['type', 'requirement'],
          },
        },
        counter: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            thickness: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['recommendation', 'thickness', 'notes'],
        },
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string' },
              qty: { type: 'string' },
              est_cost_usd: { type: 'number' },
              notes: { type: 'string' },
            },
            required: ['item', 'qty', 'est_cost_usd'],
          },
        },
        tools: {
          type: 'array',
          items: {
            type: 'object',
            properties: { tool: { type: 'string' }, optional: { type: 'boolean' } },
            required: ['tool'],
          },
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              detail: { type: 'string' },
              duration: { type: 'string' },
              tools: { type: 'array', items: { type: 'string' }, description: 'exact tools used in THIS step' },
              substeps: {
                type: 'array',
                items: { type: 'string' },
                description: '3-6 exact actions, IKEA-instruction simple ("Cut two 88 cm tracks", "Screw stud A to track B every 30 cm")',
              },
            },
            required: ['id', 'title', 'detail', 'tools', 'substeps'],
          },
        },
        safety: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'skill_level', 'est_days', 'total_est_cost_usd', 'structure_notes', 'utilities', 'counter', 'materials', 'tools', 'steps', 'safety'],
    },
    temperature: 0.1,
    maxOutputTokens: 8192,
    thinkingBudget: 0,
  })
  return parseJson(text)
}

// ---------- DIY step diagrams + step Q&A ----------

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'

/**
 * IKEA-style instruction diagram for one build step. Returns a PNG data URL.
 */
async function diyStepImage(section, step) {
  const prompt =
    `Create ONE instructional assembly diagram in the style of an IKEA manual: clean black line art on a plain white ` +
    `background, isometric view, no photorealism, no colors except a single amber accent for the part being acted on, ` +
    `minimal or no text (numbers and arrows only), simple stick-figure hands where helpful, motion arrows showing the action.\n\n` +
    `The diagram must show exactly this step of building a steel-stud outdoor kitchen section:\n` +
    `STEP: ${step.title}\n${step.detail}\n` +
    (step.substeps?.length ? `ACTIONS TO DEPICT:\n- ${step.substeps.join('\n- ')}\n` : '') +
    `\nCONTEXT (the section being built, cm): ${JSON.stringify(section)}\n` +
    `Show proportions faithful to the dimensions. One single clear diagram, not a grid of panels.`
  const res = await fetch(`${GEMINI_BASE}/${IMAGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw Object.assign(new Error(`Image generation failed (${res.status}): ${text.slice(0, 200)}`), { status: 502 })
  }
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const img = parts.find((p) => p.inlineData?.data)
  if (!img) throw Object.assign(new Error('No image returned — try again'), { status: 502 })
  return { image: `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}` }
}

/** Answer a homeowner's question about one specific build step. */
async function diyStepAsk(section, step, question) {
  const { text } = await callGemini({
    systemInstruction:
      'You are a patient master builder coaching a DIY homeowner through building a steel-stud outdoor kitchen section. ' +
      'Answer their question about the CURRENT STEP concretely and briefly (3-6 sentences), with exact measurements, ' +
      'products or techniques where relevant. If they are about to make a dangerous mistake, warn them clearly.',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `SECTION (cm): ${JSON.stringify(section)}\n\nCURRENT STEP: ${step.title}\n${step.detail}\n` +
              (step.substeps?.length ? `Actions: ${step.substeps.join(' · ')}\n` : '') +
              `\nQUESTION: ${question}`,
          },
        ],
      },
    ],
    temperature: 0.3,
    maxOutputTokens: 1024,
    thinkingBudget: 0,
  })
  return { answer: text.trim() }
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

module.exports = { searchAppliances, validateBuild, chat, scanUrl, diyQuestions, diyPlan, diyStepImage, diyStepAsk }
