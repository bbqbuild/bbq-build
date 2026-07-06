import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','3d')})
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
await p.evaluate(()=>{ const s=window.__bbq(); s.setLayout('l-left'); const a=s.addFrame(90); s.placeAppliance(a,'grill-90'); const b=s.addFrame(60); s.placeAppliance(b,'doors-60'); s.addFrame(60,undefined,false,'left') })
await p.waitForTimeout(800); await p.keyboard.press('f'); await p.waitForTimeout(500)
// zoom in
const c = await p.locator('.stage3d canvas').boundingBox()
await p.mouse.move(c.x+c.width/2, c.y+c.height/2); await p.mouse.wheel(0,-400); await p.waitForTimeout(400)
await p.screenshot({ path:'screenshots/counter-close.png', clip:{x:200,y:60,width:1300,height:760} })
await browser.close()
