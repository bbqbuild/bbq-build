import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','3d')})  // imperial default
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
await p.evaluate(()=>{ const s=window.__bbq(); s.setLayout('l-left'); s.addFrame(90); s.select({kind:'corner', id:'left'}) })
await p.waitForTimeout(400)
const heading = await p.$eval('.panel h2', e=>e.textContent)
console.log('corner heading (imperial):', JSON.stringify(heading))
// switch to cm and recheck
await p.evaluate(()=>window.__bbq().toggleUnit())
await p.waitForTimeout(300)
console.log('corner heading (cm):', JSON.stringify(await p.$eval('.panel h2', e=>e.textContent)))
await browser.close()
