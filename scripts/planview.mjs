import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear()})
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
// build a U with corners, grill, sink, base units, island, corner oven
await p.evaluate(()=>{
  const s=window.__bbq()
  const g=s.addFrame(90); s.placeAppliance(g,'grill-90')
  const sk=s.addFrame(60); s.placeAppliance(sk,'sink-40')
  s.addCornerUnit('diagonal')            // left wing
  const lf=s.addFrame(60,undefined,false,'left'); s.placeAppliance(lf,'fridge-60')
  s.addCornerUnit('square')              // right wing
  s.addFrame(60,undefined,false,'right')
  s.setCornerAppliance('left','gozney-dome')
  s.setIsland(true)
  s.addFrame(90,undefined,false,'island')
})
await p.waitForTimeout(400)
// switch to 2D
await p.evaluate(()=>{ if(window.__bbq().viewMode==='3d') window.__bbq().toggleView() })
await p.waitForTimeout(600)
await p.waitForTimeout(500)
check('in 2d view', await p.evaluate(()=>window.__bbq().viewMode)==='2d')
await p.screenshot({ path:'screenshots/planview.png' })
// click a frame in plan → selects it
const fs = await p.evaluate(()=>{ const g=window.__bbq().design.frames.find(f=>f.appliances===undefined); return null })
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS')
process.exit(fail?1:0)
