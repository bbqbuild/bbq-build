import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')

  // 1) auto-grow: small ground, add frames beyond it → ground grows to fit
  const r1 = await p.evaluate(()=>{
    const s=window.__bbq()
    s.setGround({ width: 200, depth: 200 })
    for (let i=0;i<4;i++) s.addFrame(90)          // 360cm of frames on a 200cm slab
    const d=window.__bbq().design
    return { gw: d.ground.width, run: d.frames.reduce((a,f)=>a+f.width,0) }
  })
  check('ground auto-grows to contain frames', r1.gw >= r1.run)
  console.log('auto-grow:', JSON.stringify(r1))

  // 2) santa maria built-in surround toggle
  const r2 = await p.evaluate(()=>{
    const s=window.__bbq()
    const f=s.addFrame(90); s.placeAppliance(f,'santamaria-90')
    const a=window.__bbq().design.appliances.find(x=>x.typeId==='santamaria-90')
    s.setBuiltIn(a.id, true)
    return window.__bbq().design.appliances.find(x=>x.typeId==='santamaria-90').builtIn
  })
  check('santa maria builtIn flag set', r2===true)
  // checkbox visible in inspector
  await p.evaluate(()=>{ const s=window.__bbq(); const a=s.design.appliances.find(x=>x.typeId==='santamaria-90'); s.select({kind:'appliance',id:a.id}) })
  await p.waitForTimeout(300)
  check('surround checkbox in inspector', (await p.$eval('.panel', e=>e.textContent)).includes('Built-in masonry surround'))

  // 3) single drawer catalog + placement + lowered-table compat
  const r3 = await p.evaluate(()=>{
    const s=window.__bbq()
    const f=s.addFrame(60); const ok=s.placeAppliance(f,'drawers1-60')
    const lf=s.addFrame(80,undefined,true); const okLow=s.placeAppliance(lf,'drawers1-60')
    return { ok, okLow }
  })
  check('single drawer places (incl. under smoker table)', r3.ok && r3.okLow)

  // 4) groups list + ungroup in summary panel
  await p.evaluate(()=>{ const s=window.__bbq(); s.createGroup('Test section', [s.design.frames[0].id, s.design.frames[1].id]); s.select({kind:'none'}) })
  await p.waitForTimeout(300)
  check('sections list shows group', (await p.$eval('.panel', e=>e.textContent)).includes('Test section'))
  await p.click('.group-list li .btn-icon')
  await p.waitForTimeout(300)
  check('ungroup from list works', await p.evaluate(()=>(window.__bbq().design.groups??[]).length)===0)

  // 5) screenshot the built-in santa maria
  await p.evaluate(()=>{ window.__bbq().select({kind:'none'}); window.dispatchEvent(new Event('bbq:fit')) })
  await p.waitForTimeout(400)
  await p.evaluate(()=>{ for(let i=0;i<2;i++) window.dispatchEvent(new CustomEvent('bbq:zoom',{detail:{factor:1.35}})) })
  await p.waitForTimeout(400)
  await p.screenshot({ path:'screenshots/builtin-sm.png', clip:{x:400,y:80,width:1150,height:700} })
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
