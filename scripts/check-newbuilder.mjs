import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail = 0
const check = (n, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) fail++ }

await p.goto('http://127.0.0.1:3000')
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('bbq_view', '3d') })
await p.reload()
await p.waitForSelector('.landing', { timeout: 10000 })
await p.click('.landing-cta')
await p.waitForSelector('.topbar')

// appliance-first: drop a Santa Maria (90cm, custom-ish) on blank ground → auto frame
await p.evaluate(() => window.__bbq().addFrameForAppliance('santamaria-90', 'back'))
await p.waitForTimeout(400)
let st = await p.evaluate(() => ({ frames: window.__bbq().design.frames.map(f => f.width), appls: window.__bbq().design.appliances.map(a => a.typeId) }))
check('appliance-first created a fitting frame', st.frames.length === 1 && st.frames[0] >= 90 && st.appls.includes('santamaria-90'))

// odd/kamado auto-lowered frame
await p.evaluate(() => window.__bbq().addFrameForAppliance('egg-xl', 'back'))
await p.waitForTimeout(300)
st = await p.evaluate(() => window.__bbq().design.frames.map(f => ({ w: f.width, low: !!f.lowered })))
check('kamado auto-frame is lowered', st.some(f => f.low))

// island drag: set up island then move it via store
await p.evaluate(() => {
  const s = window.__bbq()
  s.setLayout('l-right')
  s.addFrame(90, undefined, false, 'island')
  s.setIslandPos(120, 260)
})
await p.waitForTimeout(400)
const pos = await p.evaluate(() => window.__bbq().design.islandPos)
check('island position stored', pos && pos.x === 120 && pos.z === 260)
await p.keyboard.press('f'); await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/island-moved.png', clip: { x: 0, y: 40, width: 1720, height: 760 } })

// corners: U-shape has selectable corners
await p.evaluate(() => { const s = window.__bbq(); s.setLayout('u'); s.setIsland(false) })
await p.waitForTimeout(300)
await p.evaluate(() => window.__bbq().select({ kind: 'corner', id: 'left' }))
await p.waitForTimeout(200)
check('corner selectable', await p.evaluate(() => window.__bbq().selection.kind) === 'corner')

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS')
await browser.close()
process.exit(fail ? 1 : 0)
