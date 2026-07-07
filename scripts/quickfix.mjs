import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  await p.evaluate(()=>{
    const s=window.__bbq()
    const g=s.addFrame(90); s.placeAppliance(g,'grill-90')
    const f=s.addFrame(60); s.placeAppliance(f,'fridge-60')
    const k=s.addFrame(60); s.placeAppliance(k,'sink-40')
    s.select({kind:'none'})
  })
  await p.waitForTimeout(300)
  await p.click('button:has-text("AI Check")')
  await p.waitForSelector('.quickfixes', {timeout:8000})
  const n = await p.$$eval('.quickfixes li', els=>els.length)
  check('quick fixes detected', n>=2)
  console.log('quickfix count:', n)
  await p.screenshot({ path:'screenshots/quickfixes.png', clip:{x:560,y:120,width:820,height:520} })
  const framesBefore = await p.evaluate(()=>window.__bbq().design.frames.length)
  // click fix buttons until none remain (each click re-renders the list)
  for (let i=0;i<6;i++){
    const btn = await p.$('.quickfixes .btn')
    if(!btn) break
    await btn.click(); await p.waitForTimeout(400)
  }
  const remaining = await p.$$eval('.quickfixes li', els=>els.length).catch(()=>0)
  check('all fixes applied (list empty)', remaining===0)
  const st = await p.evaluate(()=>{ const d=window.__bbq().design
    const sf=d.appliances.find(a=>a.typeId==='sink-40').frameId
    return { sinkBase: d.appliances.find(a=>a.frameId===sf&&a.zone==='base')?.typeId, framesAdded: d.frames.length }
  })
  check('sink got open base', ['doors-60','door-40'].includes(st.sinkBase))
  check('landing counter added', st.framesAdded>framesBefore)
  console.log('state:', JSON.stringify(st), 'framesBefore', framesBefore)
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
