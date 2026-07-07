import { chromium } from 'playwright'
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await browser.newPage({viewport:{width:1440,height:900}})
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  const email=process.env.ADMIN_EMAIL
  await p.goto('http://127.0.0.1:3001'); await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.login-card, .landing, .home')
  if(await p.$('.landing')){ const b=(await p.$('text=Sign in'))||(await p.$('.landing-cta')); if(b) await b.click() }
  await p.waitForSelector('.login-card'); await p.click('.auth-tabs button:has-text("Create account")')
  await p.fill('input[type=email]', email); await p.fill('input[type=password]','Test123456!')
  await p.click('button[type=submit]:has-text("Create account")'); await p.waitForSelector('.home')
  await p.click('button:has-text("Admin")')
  await p.waitForSelector('.admin-page', {timeout:6000})
  check('admin is a full page (not modal)', await p.$('.admin-page')!==null && await p.$('.modal-backdrop')===null)
  check('has sub-page nav', (await p.$$('.admin-nav button')).length>=3)
  await p.screenshot({ path:'screenshots/admin-vetted.png' })
  await p.click('.admin-nav button:has-text("Pending")'); await p.waitForTimeout(300)
  check('pending sub-page', (await p.$eval('.admin-content h2', e=>e.textContent))==='Pending review')
  await p.click('.admin-nav button:has-text("companies")'); await p.waitForTimeout(300)
  await p.screenshot({ path:'screenshots/admin-companies-page.png' })
  check('companies sub-page', (await p.$eval('.admin-content h2', e=>e.textContent))==='Build companies')
  // back to app
  await p.click('button:has-text("Back to app")'); await p.waitForTimeout(300)
  check('back to app returns home', await p.$('.home')!==null)
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
