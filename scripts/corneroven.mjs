import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','3d')})
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
await p.evaluate(()=>{ const s=window.__bbq(); const a=s.addFrame(90); s.placeAppliance(a,'grill-90'); s.addCornerUnit('diagonal'); s.addFrame(60,undefined,false,'right'); s.setCornerAppliance('right','gozney-dome') })
await p.waitForTimeout(600)
check('corner has gozney oven', await p.evaluate(()=>window.__bbq().design.corners.right.top)==='gozney-dome')
// select corner → panel shows oven slot
await p.evaluate(()=>window.__bbq().select({kind:'corner', id:'right'}))
await p.waitForTimeout(300)
check('corner oven slot shows', (await p.$eval('.panel', e=>e.textContent))?.includes('Counter oven'))
await p.keyboard.press('f'); await p.waitForTimeout(500)
await p.screenshot({ path:'screenshots/corneroven.png', clip:{x:200,y:60,width:1300,height:700} })
// taboon
await p.evaluate(()=>window.__bbq().setCornerAppliance('right','taboon-90'))
await p.waitForTimeout(500)
await p.screenshot({ path:'screenshots/corner-taboon.png', clip:{x:200,y:60,width:1300,height:700} })
console.log(fail?`\n${fail} FAILURES`:'\nALL PASS')
await browser.close(); process.exit(fail?1:0)
