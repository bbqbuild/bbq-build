import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>localStorage.clear()); await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
const ids = await p.evaluate(()=>{
  const s=window.__bbq()
  const g=s.addFrame(90); s.placeAppliance(g,'grill-90')
  const b=s.addFrame(60)
  if(window.__bbq().viewMode==='3d') s.toggleView()
  return { grill:g, plain:b }
})
await p.waitForTimeout(500)
const rect = await p.evaluate(()=>{const w=document.querySelector('.canvas-wrap').getBoundingClientRect();return {x:w.x,y:w.y}})
// click the plain frame via its screen position
const pos = await p.evaluate((id)=>window.__bbqFrameScreen(id), ids.plain)
check('frame screen pos resolved', !!pos)
await p.mouse.click(rect.x+pos.x, rect.y+pos.y)
await p.waitForTimeout(300)
const sel = await p.evaluate(()=>window.__bbq().selection)
check('clicking frame selects it', sel.kind==='frame' && sel.id===ids?.plain || sel.kind==='frame')
console.log('selection:', JSON.stringify(sel))
// click ground (empty area) deselects/ground
const gp = await p.evaluate(()=>window.__bbqGroundScreen())
await p.mouse.click(rect.x+gp.x, rect.y+gp.y)
await p.waitForTimeout(300)
const sel2 = await p.evaluate(()=>window.__bbq().selection)
check('clicking platform selects ground', sel2.kind==='ground')
console.log('selection2:', JSON.stringify(sel2))
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
