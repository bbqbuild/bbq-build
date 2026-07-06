import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>localStorage.clear()); await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta')
await p.waitForSelector('.wiz', {timeout:5000})
check('wizard opens on new kitchen', await p.$('.wiz')!==null)
await p.screenshot({ path:'screenshots/wiz1.png' })
// step 1: pick a grill, sink, fridge, doors, drawers
await p.evaluate(()=>{
  const cards=[...document.querySelectorAll('.wiz-card-main')]
  const pick=(name)=>{ const c=cards.find(x=>x.querySelector('.wiz-name')?.textContent===name); c?.click() }
  pick('Gas Grill 90'); pick('Sink 40'); pick('Fridge 60'); pick('Double Doors'); pick('Drawers ×3'); pick('Griddle 60')
})
await p.waitForTimeout(200)
const summary = await p.$eval('.wiz-summary', e=>e.textContent)
check('summary counts appliances', /[56] appliance/.test(summary))
// next → space
await p.click('.wiz-nav .btn-primary')
await p.waitForTimeout(150)
check('space step shows', (await p.$eval('.wiz-body h2', e=>e.textContent)).includes('space'))
await p.screenshot({ path:'screenshots/wiz2.png' })
// next → layout
await p.click('.wiz-nav .btn-primary')
await p.waitForTimeout(150)
check('layout step shows', (await p.$eval('.wiz-body h2', e=>e.textContent)).includes('layout'))
const layoutOn = await p.$eval('.wiz-layout.on strong', e=>e.textContent).catch(()=>null)
check('a layout is preselected (recommended)', !!layoutOn)
console.log('recommended layout:', layoutOn)
// enable island
await p.click('.wiz-island input')
await p.screenshot({ path:'screenshots/wiz3.png' })
// generate
await p.click('.wiz-nav .btn-primary')
await p.waitForTimeout(700)
const d = await p.evaluate(()=>{ const s=window.__bbq().design; return { frames:s.frames.length, appls:s.appliances.length, layout:s.layout, island:s.island, runs:[...new Set(s.frames.map(f=>f.run??'back'))] } })
check('design generated with frames', d.frames>=3)
check('appliances placed', d.appls>=5)
check('island present', d.island===true)
console.log('design:', JSON.stringify(d))
check('wizard closed', await p.$('.wiz')===null)
await p.evaluate(()=>window.dispatchEvent(new Event('bbq:fit')))
await p.waitForTimeout(400)
await p.screenshot({ path:'screenshots/wiz-result.png' })
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
