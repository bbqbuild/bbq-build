import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>localStorage.clear()); await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
// wide 90 frame + a left-wing woodstore to confirm no back-poke on rotated runs
await p.evaluate(()=>{ const s=window.__bbq(); const a=s.addFrame(90); s.placeAppliance(a,'woodstore-40'); s.addCornerUnit('diagonal'); const l=s.addFrame(60,undefined,false,'left'); s.placeAppliance(l,'woodstore-40'); s.select({kind:'none'}) })
await p.waitForTimeout(500)
await p.evaluate(()=>{ window.dispatchEvent(new Event('bbq:fit')) })
await p.waitForTimeout(400)
await p.evaluate(()=>{ for(let i=0;i<2;i++) window.dispatchEvent(new CustomEvent('bbq:zoom',{detail:{factor:1.4}})) })
await p.waitForTimeout(500)
await p.screenshot({ path:'screenshots/woodstore2.png', clip:{x:480,y:120,width:1050,height:640} })
await browser.close(); console.log('done')
