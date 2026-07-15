import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(60000)
p.on('dialog', (d) => d.accept())
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
let fail = 0
const check = (n, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) fail++ }

await p.goto('http://127.0.0.1:3000')
await p.evaluate(() => { localStorage.setItem('bbq_view', '3d'); localStorage.removeItem('bbq_fab_pos'); localStorage.removeItem('bbq_chat_pos') })
await p.fill('input[type=password]', process.env.BBQ_USER_PASSWORD)
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')

// floating FAB opens window on click
check('FAB present', Boolean(await p.$('.chat-fab')))
await p.click('.chat-fab')
await p.waitForTimeout(300)
check('chat window opens on FAB click', Boolean(await p.$('.chat-window')))
await p.click('.chat-close')
await p.waitForTimeout(200)

// build a kitchen with a grill (hood), doors, drawers, sink via store
await p.evaluate(() => {
  const s = window.__bbq()
  const f1 = s.addFrame(90); s.placeAppliance(f1, 'grill-90'); s.placeAppliance(f1, 'doors-60')
  const f2 = s.addFrame(60); s.placeAppliance(f2, 'sink-40'); s.placeAppliance(f2, 'door-40')
  const f3 = s.addFrame(60); s.placeAppliance(f3, 'burner-40'); s.placeAppliance(f3, 'drawers-40')
  const f4 = s.addFrame(60); s.placeAppliance(f4, 'fridge-60')
})
await p.waitForTimeout(1200)
await p.keyboard.press('f')
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/batch-closed.png', clip: { x: 300, y: 54, width: 1120, height: 780 } })

// open animation
await p.click('.topbar >> button[title^="Open appliances"]')
await p.waitForTimeout(900)
await p.screenshot({ path: 'screenshots/batch-open.png', clip: { x: 300, y: 54, width: 1120, height: 780 } })
check('open mode toggled', await p.evaluate(() => window.__bbq().openMode) === true)

// custom frame width/height: select frame 0, change width via inspector input
await p.evaluate(() => window.__bbq().select({ kind: 'frame', id: window.__bbq().design.frames[0].id }))
await p.waitForTimeout(300)
const widthInput = await p.$('.panel .size-input')
await widthInput.click({ clickCount: 3 })
await widthInput.fill('120')
await widthInput.press('Enter')
await p.waitForTimeout(300)
check('custom frame width applied', await p.evaluate(() => window.__bbq().design.frames[0].width) === 120)

// editable ground width: open Base & layout, type a value
await p.evaluate(() => window.__bbq().select({ kind: 'none' }))
await p.waitForTimeout(150)
await p.click('.collapsible-head') // open Base & layout (collapsed by default)
await p.waitForTimeout(250)
const groundInputs = await p.$$('.collapsible-body .size-input')
if (groundInputs.length) {
  await groundInputs[0].click({ clickCount: 3 })
  await groundInputs[0].fill('500')
  await groundInputs[0].press('Enter')
  await p.waitForTimeout(300)
  check('editable ground width applied', await p.evaluate(() => window.__bbq().design.ground.width) === 500)
} else check('ground inputs present', false)

// dims toggle shows measures — just confirm no crash and showDims true
check('dims on by default', await p.evaluate(() => window.__bbq().showDims) === true)

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS')
await b.close()
process.exit(fail ? 1 : 0)
