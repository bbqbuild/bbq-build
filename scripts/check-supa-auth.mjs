import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(30000)
p.on('dialog', d=>d.accept())
p.on('pageerror', e=>console.log('PAGE ERROR:', e.message))
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}

await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear()})
await p.reload()
// signup mode
await p.waitForSelector('.login-card')
await p.click('.auth-tabs button:has-text("Create account")')
const email = `uitest.${Date.now()}@gmail.com`
await p.fill('input[type=email]', email)
await p.fill('input[type=password]', 'Test123456!')
await p.click('button[type=submit]:has-text("Create account")')
// should land on home dashboard (immediate session)
const home = await p.waitForSelector('.home', { timeout: 15000 }).catch(()=>null)
check('signup lands on home dashboard', Boolean(home))
await p.waitForTimeout(600)
await p.screenshot({ path:'screenshots/supa-home.png' })
// email shown
const shownEmail = await p.$eval('.home-email', e=>e.textContent).catch(()=>null)
check('email shown in home', shownEmail === email)
// new design → builder → add frame → autosave
await p.click('.home-new')
await p.waitForSelector('.topbar')
await p.evaluate(()=>window.__bbq().addFrame(90))
await p.waitForTimeout(2200)
check('autosaved under new user', await p.evaluate(()=>window.__bbq().savedId)!==null)
// go home, see the card
await p.click('.logo-btn')
await p.waitForSelector('.home')
const cards = await p.$$('.home-card:not(.home-new)')
check('design card appears for this user', cards.length===1)
// sign out → login screen
await p.click('.home-user .btn-ghost')
const back = await p.waitForSelector('.login-card', { timeout: 8000 }).catch(()=>null)
check('sign out returns to login', Boolean(back))
// sign back in
await p.fill('input[type=email]', email)
await p.fill('input[type=password]', 'Test123456!')
await p.click('button[type=submit]')
await p.waitForSelector('.home', { timeout: 12000 })
await p.waitForSelector('.home-card:not(.home-new)', { timeout: 10000 }).catch(()=>{})
const cards2 = await p.$$('.home-card:not(.home-new)')
check('login restores the saved design', cards2.length===1)

console.log(fail?`\n${fail} FAILURES`:'\nALL PASS')
await b.close(); process.exit(fail?1:0)
