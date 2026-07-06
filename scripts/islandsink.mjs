import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  // island bar with a sink on the LEFT frame + 2 blanks
  await p.evaluate(()=>{ const s=window.__bbq(); s.addFrame(90); s.setIsland(true); s.setIslandBar(true); const isl=s.addFrame(60,undefined,false,'island'); s.placeAppliance(isl,'sink-40'); s.addFrame(90,undefined,false,'island'); s.select({kind:'none'}) })
  await p.waitForTimeout(600)
  await p.evaluate(()=>window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(400)
  await p.screenshot({ path:'screenshots/islandsink-3d.png' })
  await p.evaluate(()=>{ if(window.__bbq().viewMode==='3d') window.__bbq().toggleView() })
  await p.waitForTimeout(400)
  await p.evaluate(()=>window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(400)
  await p.screenshot({ path:'screenshots/islandsink-2d.png' })
  console.log('done')
} catch(e){ console.log('ERR', e.message) }
await browser.close()
