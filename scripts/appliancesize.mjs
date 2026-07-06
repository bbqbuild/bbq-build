import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>localStorage.clear()); await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
// place a grill on a 90 frame and select it
await p.evaluate(()=>{ const s=window.__bbq(); const f=s.addFrame(90); s.placeAppliance(f,'grill-90'); const a=window.__bbq().design.appliances[0]; s.select({kind:'appliance', id:a.id}) })
await p.waitForTimeout(400)
const facts = await p.evaluate(()=>{
  const dts=[...document.querySelectorAll('.facts dt')].map(d=>d.textContent)
  const sizeDt=[...document.querySelectorAll('.facts div')].find(d=>d.querySelector('dt')?.textContent==='Size')
  return { dts, size: sizeDt?.querySelector('dd')?.textContent }
})
check('Size row present', facts.dts.includes('Size'))
check('Size shows W×D×H', /W ×.*D/.test(facts.size||''))
console.log('facts:', JSON.stringify(facts))
await p.screenshot({ path:'screenshots/appliancesize.png', clip:{x:1480,y:0,width:520,height:520} })
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
