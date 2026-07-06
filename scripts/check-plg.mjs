import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail = 0
const check = (n, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) fail++ }

await p.goto('http://127.0.0.1:3000')
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('bbq_view', '3d') })
await p.reload()

// landing page
await p.waitForSelector('.landing', { timeout: 10000 })
check('landing page shows', Boolean(await p.$('.landing')))
await p.screenshot({ path: 'screenshots/landing.png', fullPage: false })

// try as guest → builder, no account
await p.click('.landing-cta')
await p.waitForSelector('.topbar', { timeout: 10000 })
check('guest enters builder', Boolean(await p.$('.topbar')))
check('guest banner visible', Boolean(await p.$('.guest-banner')))
check('topbar shows Sign up to save', Boolean(await p.$('.topbar >> text=Sign up to save')))

// guest builds something
await p.evaluate(() => { const s = window.__bbq(); const f = s.addFrame(90); s.placeAppliance(f, 'grill-90') })
await p.waitForTimeout(600)
await p.keyboard.press('f'); await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/guest-builder.png', clip: { x: 0, y: 0, width: 1720, height: 780 } })

// click Sign up to save → auth screen with reason + oauth buttons
await p.click('.guest-banner .btn-primary')
await p.waitForSelector('.login-card', { timeout: 8000 })
check('auth screen shows reason', Boolean(await p.$('.login-reason')))
check('google oauth button present', Boolean(await p.$('text=Continue with Google')))
check('apple oauth button present', Boolean(await p.$('text=Continue with Apple')))
await p.screenshot({ path: 'screenshots/auth.png' })

// sign up with email → design should carry into the account (guest build preserved)
const email = `plg.${Date.now()}@gmail.com`
await p.click('.auth-tabs button:has-text("Create account")')
await p.fill('input[type=email]', email)
await p.fill('input[type=password]', 'Test123456!')
await p.click('button[type=submit]:has-text("Create account")')
// after signup, guest design (1 frame) → builder, then autosaves
await p.waitForTimeout(3000)
const st = await p.evaluate(() => ({ frames: window.__bbq().design.frames.length, savedId: window.__bbq().savedId }))
console.log('post-signup state:', JSON.stringify(st))
check('guest design carried into account', st.frames === 1)
check('carried design auto-saved', st.savedId !== null)

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS')
await browser.close()
process.exit(fail ? 1 : 0)
