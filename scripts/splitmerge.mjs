import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz')
  // wizard cancel (no appliances → no confirm) returns to landing
  await p.click('.wiz-head-actions .btn-icon')
  await p.waitForTimeout(400)
  check('wizard cancel returns to landing', await p.$('.landing')!==null)
  // re-enter, skip, test split
  await p.click('.landing-cta'); await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  const r = await p.evaluate(()=>{
    const s=window.__bbq(); const f=s.addFrame(90)
    const before=s.design.frames.length
    const ok=s.splitFrame(f)
    const st=window.__bbq()
    return { ok, added: st.design.frames.length-before, widths: st.design.frames.map(x=>x.width) }
  })
  check('split 90 → two 45 frames', r.ok && r.widths.length===2 && r.widths.every(w=>w===45))
  console.log('split:', JSON.stringify(r))
  // split with appliance: 90 grill (min90) → not splittable (no room)
  const r2 = await p.evaluate(()=>{
    const s=window.__bbq(); const f=s.addFrame(90); s.placeAppliance(f,'grill-90')
    return { ok: s.splitFrame(f) }
  })
  check('cannot split a frame with no spare room', r2.ok===false)
  // split 90 with a 40 appliance → left 40, right 50
  const r3 = await p.evaluate(()=>{
    const s=window.__bbq(); const f=s.addFrame(90); s.placeAppliance(f,'sink-40')
    const ok=s.splitFrame(f); const fr=window.__bbq().design.frames.find(x=>x.id===f)
    return { ok, leftW: fr.width }
  })
  check('split keeps appliance footprint (sink→40 left)', r3.ok && r3.leftW===40)
  console.log('r3:', JSON.stringify(r3))
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
