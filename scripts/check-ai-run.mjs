import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(90000)
p.on('dialog', (d) => d.accept())
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await p.goto('http://127.0.0.1:3000')
await p.evaluate(() => localStorage.setItem('bbq_view', '3d'))
await p.fill('input[type=password]', 'Ember&Oak-2417')
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')
await p.click('.chat-fab')
await p.waitForSelector('.chat-window')
await p.fill('.chat-input input', 'L shaped kitchen with a santa maria grill and an island with 4-5 seats')
await p.click('.chat-input .btn')
await p.waitForSelector('.chat-op', { timeout: 80000 })
await p.waitForTimeout(1500)
const state = await p.evaluate(() => {
  const d = window.__bbq().design
  const runs = {}
  for (const f of d.frames) runs[f.run ?? 'back'] = (runs[f.run ?? 'back'] ?? 0) + 1
  return { layout: d.layout, island: d.island, runs, appliances: d.appliances.length }
})
console.log('RESULT:', JSON.stringify(state))
console.log('multi-run OK:', state.layout && state.island && Object.keys(state.runs).length >= 3)
await p.keyboard.press('f')
await p.waitForTimeout(600)
await p.screenshot({ path: 'screenshots/ai-lshape-island.png', clip: { x: 300, y: 54, width: 1120, height: 780 } })
await b.close()
