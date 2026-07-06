import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  // three frames: [grill(60+grill)] [empty 60] [empty 40]; select middle empty, merge right
  const ids = await p.evaluate(()=>{ const s=window.__bbq(); const a=s.addFrame(90); s.placeAppliance(a,'grill-90'); const b=s.addFrame(60); const c=s.addFrame(40); return {a,b,c} })
  // select frame b (empty), merge right (absorb c)
  let r = await p.evaluate((id)=>{ const s=window.__bbq(); const ok=s.mergeFrame(id,'right'); const st=window.__bbq(); return {ok, frames:st.design.frames.length, w:st.design.frames.find(f=>f.id===id)?.width} }, ids.b)
  check('merge right absorbs empty neighbour', r.ok && r.frames===2 && r.w===100)
  console.log('after merge-right:', JSON.stringify(r))
  // now try merge left into the grill frame (grill has appliance on the LEFT neighbour) → allowed? b is now merged frame; its left neighbour is grill frame (has appliance) → NOT mergeable
  r = await p.evaluate((id)=>{ const s=window.__bbq(); const ok=s.mergeFrame(id,'left'); return {ok, frames:window.__bbq().design.frames.length} }, ids.b)
  check('cannot merge into a neighbour that has an appliance', r.ok===false && r.frames===2)
  // UI: select the grill frame → merge-right button should be disabled (right neighbour = merged empty is fine actually). select b and check button labels exist
  await p.evaluate((id)=>window.__bbq().select({kind:'frame',id}), ids.a)
  await p.waitForTimeout(300)
  const hasMerge = await p.$eval('.panel', e=>/Merge right/.test(e.textContent))
  check('merge buttons render in inspector', hasMerge)
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
