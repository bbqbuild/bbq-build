import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForTimeout(1500) // shared catalog loads
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  // place the shared trash drawer (id known) into an auto-frame and select it
  const ok = await p.evaluate(()=>{ const s=window.__bbq(); return s.addFrameForAppliance('ai-turbo-grills-doubletrash-2','back') })
  check('placed shared imported item', ok===true)
  await p.evaluate(()=>{ const s=window.__bbq(); const a=s.design.appliances[0]; s.select({kind:'appliance',id:a.id}) })
  await p.waitForTimeout(300)
  const panel = await p.$eval('.panel', e=>e.textContent)
  check('inspector shows Cutout dims', /Cutout/.test(panel))
  console.log('cutout row present:', /Cutout/.test(panel))
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
