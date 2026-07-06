import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>localStorage.clear()); await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')

// case A: empty 90 frame + drop grill onto it → places, no new frame
let r = await p.evaluate(()=>{
  const s=window.__bbq(); const f=s.addFrame(90)
  const before=s.design.frames.length
  s.tryDropAppliance(f,'grill-90','back')
  const st=window.__bbq()
  return { framesBefore:before, framesAfter:st.design.frames.length, appls:st.design.appliances.length, pending:!!st.pendingDrop }
})
check('A: drop into empty frame places (no new frame)', r.framesAfter===r.framesBefore && r.appls===1 && !r.pending)
console.log('A', JSON.stringify(r))

// case B: same frame already has grill on top → drop another grill → prompt (occupied)
r = await p.evaluate(()=>{
  const s=window.__bbq(); const f=s.design.frames[0].id
  s.tryDropAppliance(f,'grill-90','back')
  const st=window.__bbq(); return { pending: st.pendingDrop }
})
check('B: drop onto occupied top slot prompts', !!r.pending && !!r.pending.occupantId && r.pending.fits===true)
console.log('B', JSON.stringify(r.pending))

// resolve replace → still one appliance, replaced
r = await p.evaluate(()=>{ window.__bbq().resolvePendingDrop('replace'); const st=window.__bbq(); return { appls:st.design.appliances.length, pending:!!st.pendingDrop } })
check('B-replace: replaces, no extra frame/appliance', r.appls===1 && !r.pending)

// case C: too-small frame → drop grill (needs 80) onto a 40 frame → prompt, fits=false, no replace option
r = await p.evaluate(()=>{
  const s=window.__bbq(); const f=s.addFrame(40)
  s.tryDropAppliance(f,'grill-90','back')
  const st=window.__bbq(); return { pending: st.pendingDrop, frames:st.design.frames.length }
})
check('C: too-small frame prompts with fits=false', !!r.pending && r.pending.fits===false && !r.pending.occupantId)
console.log('C', JSON.stringify(r.pending))

// resolve newframe → adds a frame sized for the grill and places it
r = await p.evaluate(()=>{ const before=window.__bbq().design.frames.length; window.__bbq().resolvePendingDrop('newframe'); const st=window.__bbq(); return { added: st.design.frames.length-before, appls:st.design.appliances.length } })
check('C-newframe: creates a new frame for it', r.added===1)
console.log('C-newframe', JSON.stringify(r))

await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
