import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
p.on('pageerror', e=>console.log('PAGEERROR:', e.message.slice(0,150)))
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','2d'); localStorage.setItem('bbq_unit','cm')})
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
await p.evaluate(()=>{ const s=window.__bbq(); const f=s.addFrame(60); s.select({kind:'frame', id:f}) })
await p.waitForTimeout(400)
// find the Width size input in the frame panel
const inputs = await p.$$('.panel .size-input')
console.log('size inputs in frame panel:', inputs.length)
if (inputs.length) {
  const before = await p.evaluate(()=>window.__bbq().design.frames[0].width)
  await inputs[0].click({clickCount:3})
  await inputs[0].fill('73')
  await inputs[0].press('Enter')
  await p.waitForTimeout(400)
  const after = await p.evaluate(()=>window.__bbq().design.frames[0].width)
  console.log('width before:', before, 'after typing 73:', after)
}
await browser.close()
