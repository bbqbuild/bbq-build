import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(60000)
p.on('dialog', (d) => d.accept())
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
let fail = 0
const check = (n, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) fail++ }

await p.goto('http://127.0.0.1:3000')
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('bbq_view', '3d') })
await p.reload()
await p.fill('input[type=password]', 'Ember&Oak-2417')
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')

check('default unit imperial', await p.evaluate(() => window.__bbq().unit) === 'imperial')
check('default ground concrete', await p.evaluate(() => window.__bbq().design.ground.type) === 'concrete')
check('my designs in user menu', await p.$('.avatar') !== null)

// add a frame → auto-save should kick in and set savedId
await p.evaluate(() => window.__bbq().addFrame(90))
await p.waitForTimeout(2200) // debounce 1.2s + save
const savedId = await p.evaluate(() => window.__bbq().savedId)
check('auto-saved (savedId set)', savedId !== null)
check('not dirty after autosave', await p.evaluate(() => window.__bbq().dirty) === false)

// save status text present
const status = await p.$eval('.save-status', e => e.textContent).catch(() => null)
check('save status shows Saved', status && status.includes('Saved'))

// my designs modal lists it
await p.click('.avatar')
await p.click('text=My designs…')
const row = await p.waitForSelector('.design-load', { timeout: 5000 }).catch(() => null)
check('design listed in My designs', Boolean(row))

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS')
await b.close()
process.exit(fail ? 1 : 0)
