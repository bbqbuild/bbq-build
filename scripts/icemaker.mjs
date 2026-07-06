import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  await p.evaluate(()=>{ const s=window.__bbq(); const a=s.addFrame(60); s.placeAppliance(a,'icemaker-60'); const b=s.addFrame(60); s.placeAppliance(b,'fridge-60'); s.select({kind:'none'}) })
  await p.waitForTimeout(600)
  await p.evaluate(()=>window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(300)
  await p.evaluate(()=>{ for(let i=0;i<3;i++) window.dispatchEvent(new CustomEvent('bbq:zoom',{detail:{factor:1.4}})) })
  await p.waitForTimeout(500)
  await p.screenshot({ path:'screenshots/icemaker.png', clip:{x:520,y:150,width:900,height:560} })
  console.log('done')
} catch(e){ console.log('ERR', e.message) }
await browser.close()
