import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1600, height: 950 } })
p.setDefaultTimeout(90000)
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await p.goto('http://127.0.0.1:3000')
await p.fill('input[type=password]', process.env.BBQ_USER_PASSWORD)
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')
// build: 90 grill frame + smoker table + kamado + santa maria attempt
await p.evaluate(() => {
  const s = window.__bbq()
  const f1 = s.addFrame(90)
  s.placeAppliance(f1, 'santamaria-90')
  const f2 = s.addFrame(80, undefined, true)
  s.placeAppliance(f2, 'egg-xl')
  s.placeAppliance(f2, 'woodstore-40')
  const f3 = s.addFrame(80, undefined, true)
  s.placeAppliance(f3, 'primo-xl')
  const f4 = s.addFrame(60)
  s.placeAppliance(f4, 'fridge-60')
})
await p.keyboard.press('f')
await p.waitForTimeout(600)
await p.screenshot({ path: 'screenshots/smoker.png', clip: { x: 280, y: 54, width: 1030, height: 700 } })
// rule checks
const results = await p.evaluate(() => {
  const s = window.__bbq()
  const out = []
  const grillFrame = s.design.frames[0]
  const lowFrame = s.design.frames[1]
  out.push(['kamado on normal frame blocked', s.placeAppliance(grillFrame.id, 'egg-xl') === false])
  out.push(['grill on lowered frame blocked', s.placeAppliance(lowFrame.id, 'grill-80') === false])
  out.push(['fridge under santamaria blocked', s.placeAppliance(grillFrame.id, 'fridge-60') === false])
  out.push(['doors under santamaria allowed', s.placeAppliance(grillFrame.id, 'doors-60') === true])
  const f5 = s.addFrame(40)
  out.push(['sink over drawers blocked', (s.placeAppliance(f5.id ?? f5, 'drawers-40'), s.placeAppliance(f5.id ?? f5, 'sink-40')) === false])
  return out
})
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
await b.close()
