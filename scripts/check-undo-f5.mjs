import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','3d')})
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')

// smart undo: nudge a frame height 5x → one undo reverts all
await p.evaluate(()=>{ const s=window.__bbq(); const f=s.addFrame(60); s.select({kind:'frame', id:f}) })
await p.waitForTimeout(200)
const baseH = await p.evaluate(()=>window.__bbq().design.frames[0].height ?? 82)
await p.evaluate(()=>{ const id=window.__bbq().design.frames[0].id; for(let i=0;i<5;i++){ const h=window.__bbq().design.frames[0].height ?? 82; window.__bbq().setFrameHeight(id, h+5) } })
await p.waitForTimeout(200)
const afterNudges = await p.evaluate(()=>window.__bbq().design.frames[0].height)
check('5 nudges applied', afterNudges === baseH + 25)
await p.evaluate(()=>window.__bbq().undo())
await p.waitForTimeout(200)
const afterUndo = await p.evaluate(()=>window.__bbq().design.frames[0].height ?? 82)
check('one undo reverts all 5 nudges', afterUndo === baseH)
// the frame itself still exists (undo only reverted the height batch)
check('undo did not remove the frame', await p.evaluate(()=>window.__bbq().design.frames.length)===1)

// F5 persistence as guest
const before = await p.evaluate(()=>window.__bbq().design.frames.length)
await p.reload()
await p.waitForSelector('.topbar', { timeout: 12000 }).catch(()=>{})
const restored = Boolean(await p.$('.topbar'))
check('builder restored after F5', restored)
if (restored) check('design frames restored', await p.evaluate(()=>window.__bbq().design.frames.length)===before)

console.log(fail?`\n${fail} FAILURES`:'\nALL PASS')
await browser.close(); process.exit(fail?1:0)
