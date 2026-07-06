import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
p.on('pageerror', e=>console.log('PAGEERROR:', e.message.slice(0,150)))
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','3d')})
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')

// SHAPE selector should be gone
check('no shape/layout chips', (await p.$('.layout-chip')) === null)

// add frames to main run
await p.click('.frame-card >> nth=3') // 90
await p.click('.frame-card >> nth=1') // 60
let runs = await p.evaluate(()=>window.__bbq().design.frames.map(f=>f.run??'back'))
check('frames go to back run', runs.every(r=>r==='back') && runs.length===2)

// add a diagonal corner → opens right wing, activeRun=right
await p.click('.corner-card >> nth=0')
await p.waitForTimeout(200)
check('corner opened right wing', await p.evaluate(()=>window.__bbq().design.layout)==='l-right')
check('activeRun switched to right', await p.evaluate(()=>window.__bbq().activeRun)==='right')
check('right corner is diagonal', await p.evaluate(()=>window.__bbq().design.corners.right.style)==='diagonal')

// new frames now go to right wing
await p.click('.frame-card >> nth=1') // 60
check('new frame in right wing', await p.evaluate(()=>window.__bbq().design.frames.some(f=>f.run==='right')))

// custom frame card adds a frame
await p.click('.frame-card-custom')
check('custom frame added', await p.evaluate(()=>window.__bbq().design.frames.length)===4)

// add a square corner → U with left corner square
await p.click('.corner-card >> nth=1')
await p.waitForTimeout(200)
check('U layout with left square corner', await p.evaluate(()=>window.__bbq().design.layout==='u' && window.__bbq().design.corners.left.style==='square'))

await p.keyboard.press('f'); await p.waitForTimeout(500)
await p.screenshot({ path:'screenshots/cornerdrive.png', clip:{x:0,y:40,width:1720,height:760} })

// F5 persistence: reload as guest, design should restore
const before = await p.evaluate(()=>window.__bbq().design.frames.length)
await p.reload()
await p.waitForSelector('.topbar', { timeout: 10000 })
const after = await p.evaluate(()=>window.__bbq().design.frames.length)
check('design persists across F5', after===before && after>0)

console.log(fail?`\n${fail} FAILURES`:'\nALL PASS')
await browser.close(); process.exit(fail?1:0)
