import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(60000)
await p.goto('http://127.0.0.1:3000')
await p.fill('input[type=password]', 'Ember&Oak-2417')
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')
await p.click('text=✨ Assistant').catch(() => {})
await p.evaluate(() => {
  const s = window.__bbq()
  s.addFrame(90); s.addFrame(60); s.addFrame(40)
})
await p.waitForTimeout(300)
const f0 = await p.evaluate(() => {
  const s = window.__bbq()
  return { id: s.design.frames[0].id, pos: window.__bbqFrameScreen(s.design.frames[0].id) }
})
const last = await p.evaluate(() => {
  const s = window.__bbq()
  return window.__bbqFrameScreen(s.design.frames[2].id)
})
console.log('from', f0.pos, 'to', last)
await p.mouse.move(f0.pos.x, f0.pos.y)
await p.mouse.down()
for (let i = 0; i <= 12; i++) {
  await p.mouse.move(f0.pos.x + ((last.x + 60 - f0.pos.x) * i) / 12, f0.pos.y + ((last.y - f0.pos.y) * i) / 12)
  await p.waitForTimeout(30)
}
await p.mouse.up()
console.log(await p.evaluate(() => JSON.stringify(window.__bbq().design.frames.map((f) => f.width))))
await b.close()
