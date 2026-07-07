import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  await p.evaluate(()=>{
    const s=window.__bbq()
    s.addFrame(90); // back
    s.setIsland(true)
    const i1=s.addFrame(90,undefined,false,'island'); s.placeAppliance(i1,'grill-90')
    s.addFrame(60,undefined,false,'island')
    s.addIslandCorner('diagonal')
    const w1=s.addFrame(60,undefined,false,'island-wing'); s.placeAppliance(w1,'sink-40')
    s.addFrame(60,undefined,false,'island-wing')
    s.select({kind:'none'})
  })
  await p.waitForTimeout(700)
  await p.evaluate(()=>window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(400)
  await p.screenshot({ path:'screenshots/lisland-3d.png' })
  await p.evaluate(()=>{ if(window.__bbq().viewMode==='3d') window.__bbq().toggleView() })
  await p.waitForTimeout(400)
  await p.evaluate(()=>window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(400)
  await p.screenshot({ path:'screenshots/lisland-2d.png' })
  console.log('done, frames:', await p.evaluate(()=>window.__bbq().design.frames.map(f=>({w:f.width,run:f.run??'back'}))))
} catch(e){ console.log('ERR', e.message) }
await browser.close()
