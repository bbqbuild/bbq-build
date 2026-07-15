import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(60000)
p.on('dialog', (d) => d.accept())
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await p.goto('http://127.0.0.1:3000')
await p.evaluate(() => localStorage.setItem('bbq_view', '3d'))
await p.fill('input[type=password]', process.env.BBQ_USER_PASSWORD)
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')

// Build an L-right kitchen with frames in back and right
await p.evaluate(() => {
  const s = window.__bbq()
  s.setLayout('l-right')
  const f1 = s.addFrame(90); s.placeAppliance(f1, 'grill-90')
  const f2 = s.addFrame(60, undefined, false, 'right'); s.placeAppliance(f2, 'fridge-60')
})
await p.waitForTimeout(800)
await p.keyboard.press('f')
await p.waitForTimeout(500)

// what does cornerFor return / does the design have corners?
const info = await p.evaluate(() => {
  const d = window.__bbq().design
  return { layout: d.layout, corners: d.corners, frames: d.frames.map(f => `${f.run??'back'}:${f.width}`) }
})
console.log('DESIGN:', JSON.stringify(info))

// try selecting the corner via store
await p.evaluate(() => window.__bbq().select({ kind: 'corner', id: 'right' }))
await p.waitForTimeout(300)
const panel = await p.$eval('.inspector .panel h2', e => e.textContent).catch(() => 'NO PANEL')
console.log('corner panel heading:', panel)

await p.screenshot({ path: 'screenshots/corner-probe.png', clip: { x: 300, y: 54, width: 1120, height: 780 } })
await b.close()
