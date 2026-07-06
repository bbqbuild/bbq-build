import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(90000)
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE:', m.text().slice(0, 200)))
await p.goto('http://127.0.0.1:3000')
await p.fill('input[type=password]', 'Ember&Oak-2417')
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')
// collapse chat for more canvas room
await p.click('text=✨ Assistant').catch(() => {})

// presets modal (thumbnails should show L/U shapes)
await p.click('.topbar >> text=Presets')
await p.waitForTimeout(900)
await p.screenshot({ path: 'screenshots/l-presets.png' })

// apply U-Shape Bar
await p.click('text=U-Shape Bar')
await p.waitForTimeout(900)
await p.keyboard.press('f')
await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/l-ushape.png' })

// apply Island Entertainer (L + island)
await p.click('.topbar >> text=Presets')
await p.waitForTimeout(400)
await p.click('text=Island Entertainer')
await p.waitForTimeout(900)
await p.keyboard.press('f')
await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/l-island.png' })

const st = await p.evaluate(() => {
  const s = window.__bbq()
  return { layout: s.design.layout, island: s.design.island, frames: s.design.frames.map((f) => `${f.run ?? 'back'}:${f.width}`) }
})
console.log(JSON.stringify(st))
await b.close()
console.log('done')
