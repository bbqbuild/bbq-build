import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>localStorage.clear()); await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta')
// skip wizard
await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost')
await p.waitForTimeout(200)
await p.evaluate(()=>{ const s=window.__bbq(); s.addFrame(90); s.addCornerUnit('diagonal'); s.addFrame(60,undefined,false,'right'); s.setCornerBase('right','doors-60'); s.setCornerAppliance('right','gozney-dome') })
await p.waitForTimeout(500)
check('corner base set', await p.evaluate(()=>window.__bbq().design.corners.right.base)==='doors-60')
// price includes it
const spec = await p.evaluate(()=>{ const s=window.__bbq(); return { has: JSON.stringify(s.design.corners.left) } })
console.log(spec.has)
// select corner → base slot visible
await p.evaluate(()=>window.__bbq().select({kind:'corner',id:'right'}))
await p.waitForTimeout(300)
check('corner base slot in inspector', (await p.$eval('.panel', e=>e.textContent)).includes('Corner base'))
await p.evaluate(()=>window.dispatchEvent(new Event('bbq:fit')))
await p.waitForTimeout(300)
await p.evaluate(()=>{ for(let i=0;i<2;i++) window.dispatchEvent(new CustomEvent('bbq:zoom',{detail:{factor:1.4}})) })
await p.waitForTimeout(500)
await p.screenshot({ path:'screenshots/cornerbase.png', clip:{x:470,y:80,width:1050,height:680} })
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
