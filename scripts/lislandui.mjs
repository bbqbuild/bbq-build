import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  // enable island via UI checkbox
  await p.evaluate(()=>{ const s=window.__bbq(); s.addFrame(90); s.setIsland(true); s.addFrame(90,undefined,false,'island') })
  await p.waitForTimeout(300)
  // click "Add island corner"
  await p.click('.island-corner-row button')
  await p.waitForTimeout(300)
  check('islandCorner set via UI', await p.evaluate(()=>window.__bbq().design.islandCorner)===true)
  check('activeRun is island-wing', await p.evaluate(()=>window.__bbq().activeRun)==='island-wing')
  // island-wing run pill exists
  const pills = await p.$$eval('.run-pill', els=>els.map(e=>e.textContent))
  check('island wing pill present', pills.includes('Isl. wing'))
  console.log('pills:', JSON.stringify(pills))
  // add a frame → goes to island-wing
  await p.evaluate(()=>window.__bbq().addFrame(60,undefined,false,window.__bbq().activeRun))
  await p.waitForTimeout(200)
  const wingFrames = await p.evaluate(()=>window.__bbq().design.frames.filter(f=>f.run==='island-wing').length)
  check('frame added to island-wing', wingFrames===1)
  // remove island corner → wing folds back
  await p.click('.island-corner-row button')  // now "Remove island corner"
  await p.waitForTimeout(300)
  check('island corner removed', await p.evaluate(()=>window.__bbq().design.islandCorner)===false)
  check('wing frames folded to island', await p.evaluate(()=>window.__bbq().design.frames.filter(f=>f.run==='island-wing').length)===0)
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
