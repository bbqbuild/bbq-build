import { chromium } from 'playwright'
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await browser.newPage({viewport:{width:1440,height:900}})
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  const email=process.env.ADMIN_EMAIL
  await p.goto('http://127.0.0.1:3001'); await p.evaluate(()=>localStorage.clear()); await p.reload()
  await p.waitForSelector('.login-card, .landing'); if(await p.$('.landing')){ const b=(await p.$('text=Sign in'))||(await p.$('.landing-cta')); if(b) await b.click() }
  await p.waitForSelector('.login-card'); await p.click('.auth-tabs button:has-text("Create account")')
  await p.fill('input[type=email]', email); await p.fill('input[type=password]','Test123456!')
  await p.click('button[type=submit]:has-text("Create account")'); await p.waitForSelector('.home')
  await p.click('button:has-text("Admin")'); await p.waitForSelector('.admin-page')
  // nav is object-type based: exactly Appliances + Build companies (no Vetted/Pending in nav)
  const nav = await p.$$eval('.admin-nav button', els=>els.map(e=>e.textContent.replace(/\d+$/,'').trim()))
  check('nav object-type based (Appliances, Build companies)', nav.length===2 && nav.some(x=>/Appliances/.test(x)) && nav.some(x=>/companies/i.test(x)))
  console.log('nav:', JSON.stringify(nav))
  // filter tabs present inside appliances screen
  check('has All/Vetted/Pending filter tabs', (await p.$$('.admin-filter-tabs button')).length===3)
  // seed a product via scan
  await p.fill('.admin-scan input','https://www.bbqguys.com/i/3184975/coyote-outdoor-living/30-inch-farmhouse-sink-c3fhsink')
  await p.click('.admin-scan button:has-text("Scan & add")')
  await p.waitForSelector('.admin-row-click', {timeout:60000})
  // click the row → detail pane
  await p.click('.admin-row-click')
  await p.waitForSelector('.admin-detail-head', {timeout:4000})
  check('click row opens detail pane', await p.$('.admin-detail-head')!==null)
  const detailText = await p.$eval('.admin-detail', e=>e.textContent)
  check('detail shows brand + price + source', /Coyote/.test(detailText) && /\$1,159/.test(detailText) && /source listing/i.test(detailText))
  await p.screenshot({ path:'screenshots/admin-detail.png' })
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
