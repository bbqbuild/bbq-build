import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(90000)
p.on('dialog', (d) => d.accept())
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await p.goto('http://127.0.0.1:3000')
await p.fill('input[type=password]', process.env.BBQ_USER_PASSWORD)
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')
await p.click('text=✨ Assistant').catch(() => {})
await p.click('.topbar >> text=Presets')
await p.waitForTimeout(400)
await p.click('text=Island Entertainer')
await p.waitForTimeout(700)
await p.keyboard.press('f')
await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/island-full.png' })
const info = await p.evaluate(() => {
  const d = window.__bbq().design
  return { layout: d.layout, island: d.island, frames: d.frames.map((f) => `${f.run ?? 'back'}:${f.width}`) }
})
console.log(JSON.stringify(info))
await b.close()
