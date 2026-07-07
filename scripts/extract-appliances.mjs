#!/usr/bin/env node
// Populate/repopulate the bbq.build catalog with real vendor appliances.
//
// Uses the app's own grounded-Gemini search (server/ai.js searchAppliances) to
// find real, currently-sold products per category across the top vendors, with
// specs + price + source link. Writes a categorized report for approval and
// (optionally) submits them to the shared catalog as PENDING for admin review.
//
//   set -a; source .env; set +a
//   node scripts/extract-appliances.mjs                 # report only
//   node scripts/extract-appliances.mjs --push          # + submit to DB as pending
//   node scripts/extract-appliances.mjs --only grill,sink
//
// Output: catalog-extract/appliances.json + catalog-extract/report.md
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const ai = require('../server/ai.js')
const storage = require('../server/storage.js')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'catalog-extract')

const args = process.argv.slice(2)
const PUSH = args.includes('--push')
const onlyArg = args[args.indexOf('--only') + 1]
const ONLY = args.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null
const TARGET = 10

// category → app category + queries (vendor-diverse) to reach the target count
const PLAN = [
  { key: 'grill', queries: ['built-in gas grill outdoor kitchen Napoleon Blaze Weber', 'built-in stainless gas grill Bull Lion Alfresco Coyote', 'built-in propane natural gas grill VEVOR RCS'] },
  { key: 'santamaria', queries: ['santa maria argentine gaucho grill built-in wood charcoal', 'built-in gaucho santa maria grill Tagwood Kalamera'] },
  { key: 'kamado', queries: ['kamado ceramic grill Big Green Egg Primo Kamado Joe built-in', 'built-in ceramic kamado smoker outdoor kitchen'] },
  { key: 'griddle', queries: ['built-in flat top griddle plancha outdoor kitchen Le Griddle Blackstone', 'built-in teppanyaki griddle stainless outdoor'] },
  { key: 'burner', queries: ['built-in side burner power burner outdoor kitchen', 'built-in double side burner stainless propane'] },
  { key: 'pizza', queries: ['built-in outdoor pizza oven Gozney Ooni Alfa Fontana', 'countertop gas wood pizza oven outdoor kitchen'] },
  { key: 'sink', queries: ['outdoor kitchen drop-in sink stainless', 'built-in bar prep sink outdoor kitchen faucet', 'RCS Coyote Lynx Sunstone outdoor sink'] },
  { key: 'fridge', queries: ['outdoor rated built-in refrigerator stainless', 'built-in outdoor fridge undercounter 24 inch stainless', 'Blaze Coyote Summerset outdoor refrigerator'] },
  { key: 'kegerator', queries: ['outdoor built-in kegerator stainless', 'outdoor rated beer dispenser kegerator built-in', 'Blaze Coyote Summerset outdoor kegerator'] },
  { key: 'icemaker', queries: ['outdoor built-in ice maker stainless', 'outdoor rated undercounter ice machine built-in', 'Blaze Coyote outdoor ice maker'] },
  { key: 'icebin', queries: ['drop-in ice bin cooler outdoor kitchen stainless', 'built-in ice chest bin outdoor bar', 'RCS Coyote Sunstone drop-in ice bin'] },
  { key: 'trash', queries: ['outdoor kitchen trash drawer pull-out stainless', 'built-in double trash recycle drawer outdoor', 'Blaze Coyote RCS Sunstone trash drawer bin', 'stainless roll-out waste drawer outdoor kitchen'] },
  { key: 'doors', queries: ['outdoor kitchen stainless access doors', 'built-in double door outdoor kitchen stainless', 'Blaze Coyote RCS single double access door'] },
  { key: 'drawers', queries: ['outdoor kitchen stainless storage drawers', 'built-in triple drawer outdoor kitchen stainless', 'Blaze Coyote RCS Sunstone drawer stack'] },
  { key: 'woodstore', queries: ['outdoor kitchen firewood storage drawer', 'built-in wood storage santa maria outdoor', 'stainless firewood log storage outdoor kitchen'] },
]

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function collect(plan) {
  const byKey = new Map()
  const item = (p) => ({
    brand: p.brand,
    model: p.model,
    category: p.category,
    width_cm: Math.round(p.width_cm),
    price_usd: Math.round(p.price_usd),
    url: p.url || '',
    blurb: p.blurb,
  })
  for (const q of plan.queries) {
    if (byKey.size >= TARGET) break
    try {
      const { items } = await ai.searchAppliances(q)
      for (const p of items) {
        if (p.category !== plan.key) continue // keep the category focused
        const k = slug(`${p.brand}-${p.model}`)
        if (!byKey.has(k)) byKey.set(k, item(p))
      }
      process.stdout.write(`  ${plan.key}: ${byKey.size}/${TARGET}\n`)
    } catch (e) {
      process.stdout.write(`  ${plan.key} query failed: ${e.message}\n`)
    }
    await sleep(1200)
  }
  return [...byKey.values()]
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const result = {}
  for (const plan of PLAN) {
    if (ONLY && !ONLY.has(plan.key)) continue
    console.log(`▸ ${plan.key}`)
    result[plan.key] = await collect(plan)
  }

  writeFileSync(join(OUT, 'appliances.json'), JSON.stringify(result, null, 2))

  // markdown report grouped by category
  let md = `# bbq.build catalog extract\n\nGenerated ${new Date().toISOString()}\n\n`
  let total = 0
  for (const [cat, items] of Object.entries(result)) {
    md += `## ${cat} (${items.length})\n\n`
    for (const i of items) {
      total++
      md += `- **${i.brand} ${i.model}** — ${i.width_cm} cm · $${i.price_usd}${i.url ? ` · [source](${i.url})` : ''}\n  - ${i.blurb}\n`
    }
    md += `\n`
  }
  md = md.replace('\n\n', `\n\n**${total} products across ${Object.keys(result).length} categories.**\n\n`)
  writeFileSync(join(OUT, 'report.md'), md)
  console.log(`\nWrote ${total} products → catalog-extract/report.md + appliances.json`)

  if (PUSH) {
    const CATEGORY_MAP = {
      grill: { paintAs: 'grill-90', zone: 'top', mount: 'dropin', icon: '🔥' },
      santamaria: { paintAs: 'santamaria-90', zone: 'top', mount: 'dropin', icon: '🥩' },
      kamado: { paintAs: 'egg-xl', zone: 'top', mount: 'kamado', icon: '🥚' },
      griddle: { paintAs: 'griddle-60', zone: 'top', mount: 'dropin', icon: '🍳' },
      burner: { paintAs: 'burner-40', zone: 'top', mount: 'dropin', icon: '🫕' },
      sink: { paintAs: 'sink-40', zone: 'top', mount: 'dropin', icon: '🚰' },
      icebin: { paintAs: 'icebin-40', zone: 'top', mount: 'dropin', icon: '🧊' },
      pizza: { paintAs: 'pizza-60', zone: 'top', mount: 'oncounter', icon: '🍕' },
      fridge: { paintAs: 'fridge-60', zone: 'base', mount: 'undercounter', icon: '🥶' },
      kegerator: { paintAs: 'kegerator-60', zone: 'base', mount: 'undercounter', icon: '🍺' },
      icemaker: { paintAs: 'icemaker-60', zone: 'base', mount: 'undercounter', icon: '❄️' },
      drawers: { paintAs: 'drawers-40', zone: 'base', mount: 'undercounter', icon: '🗄️' },
      doors: { paintAs: 'doors-60', zone: 'base', mount: 'undercounter', icon: '🚪' },
      trash: { paintAs: 'trash-40', zone: 'base', mount: 'undercounter', icon: '🗑️' },
      woodstore: { paintAs: 'woodstore-40', zone: 'base', mount: 'undercounter', icon: '🪵' },
    }
    const FRAME_WIDTHS = [40, 60, 80, 90]
    const neededWidth = (w) => FRAME_WIDTHS.find((x) => w <= x) ?? Math.max(90, Math.ceil(w / 5) * 5)
    const store = await storage.createStorage()
    let pushed = 0
    for (const [cat, items] of Object.entries(result)) {
      const spec = CATEGORY_MAP[cat]
      if (!spec) continue
      for (const i of items) {
        const id = `ai-${slug(`${i.brand}-${i.model}`)}`
        const type = {
          id,
          name: `${i.brand} ${i.model}`,
          shortName: i.model.length > 18 ? `${i.model.slice(0, 17)}…` : i.model,
          brand: i.brand,
          zone: spec.zone,
          mount: spec.mount,
          minFrameWidth: neededWidth(i.width_cm),
          price: i.price_usd,
          description: i.blurb,
          icon: spec.icon,
          custom: true,
          paintAs: spec.paintAs,
          url: i.url,
        }
        await store.addPending(id, type, 'catalog-extract')
        pushed++
      }
    }
    console.log(`Submitted ${pushed} products to the catalog as PENDING (review in the admin panel).`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
