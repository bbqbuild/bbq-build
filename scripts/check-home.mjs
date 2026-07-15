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
await p.fill('input[type=password]', process.env.BBQ_USER_PASSWORD)
await p.click('button[type=submit]')

// after login → home dashboard
await p.waitForSelector('.home', { timeout: 8000 })
check('home dashboard shown after login', Boolean(await p.$('.home')))
check('new-design card present', Boolean(await p.$('.home-new')))
await p.waitForTimeout(800)
await p.screenshot({ path: 'screenshots/home.png' })

// existing designs from prior tests should show as cards (or empty)
const cards = await p.$$('.home-card:not(.home-new)')
console.log('existing design cards:', cards.length)

// click New design → builder
await p.click('.home-new')
await p.waitForSelector('.topbar', { timeout: 8000 })
check('new design opens builder', Boolean(await p.$('.topbar')))

// add a frame, wait for autosave, go home via logo
await p.evaluate(() => window.__bbq().addFrame(90))
await p.waitForTimeout(2200)
await p.click('.logo-btn')
await p.waitForSelector('.home', { timeout: 8000 })
const cards2 = await p.$$('.home-card:not(.home-new)')
check('design appears as card after autosave', cards2.length >= 1)
await p.screenshot({ path: 'screenshots/home-with-cards.png' })

// open the first card → builder with that design
await p.click('.home-card:not(.home-new)')
await p.waitForSelector('.topbar', { timeout: 8000 })
check('opening a card enters builder', Boolean(await p.$('.topbar')))
check('opened design has the frame', await p.evaluate(() => window.__bbq().design.frames.length) >= 1)

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS')
await b.close()
process.exit(fail ? 1 : 0)
