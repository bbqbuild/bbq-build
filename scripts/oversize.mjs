import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>localStorage.clear()); await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
// simulate a scanned 124cm Tagwood santamaria being added + placed
const r = await p.evaluate(async ()=>{
  const mod = await import('/src/catalog/aiProducts.ts').catch(()=>null)
  return null // module import may not work in prod build; use store path instead
})
// Use the store directly: register a custom oversize appliance the way Sidebar.add() would,
// by importing toApplianceType isn't available at runtime; instead build the type inline like it does.
const res = await p.evaluate(()=>{
  const s = window.__bbq()
  // mimic toApplianceType output for a 124cm santamaria
  const t = {
    id:'ai-tagwood-bbq05ssf', name:'Tagwood BBQ BBQ05SSF', shortName:'BBQ05SSF', brand:'Tagwood',
    zone:'top', mount:'dropin', minFrameWidth:125, price:5000, description:'Argentine grill',
    icon:'🥩', custom:true, paintAs:'santamaria-90'
  }
  s.addCustomAppliance(t)
  const before = window.__bbq().design.frames.length
  const ok = s.addFrameForAppliance('ai-tagwood-bbq05ssf','back')
  const st = window.__bbq()
  const frame = st.design.frames[st.design.frames.length-1]
  return { ok, added: st.design.frames.length-before, frameWidth: frame?.width, appls: st.design.appliances.length, custom: st.design.custom?.length }
})
check('oversize appliance registered as custom', res.custom>=1)
check('drop creates a frame', res.ok===true && res.added===1)
check('frame sized to 125cm (custom)', res.frameWidth===125)
check('appliance placed', res.appls===1)
console.log(JSON.stringify(res))
await p.waitForTimeout(300)
await p.screenshot({ path:'screenshots/oversize.png', clip:{x:470,y:60,width:1200,height:700} })
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
