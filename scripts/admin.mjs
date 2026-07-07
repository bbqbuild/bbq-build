import { chromium } from 'playwright'
const TRASH = 'https://www.bbqguys.com/i/3082136/turbo-grills/double-trash-drawer-front-to-back-doubletrash-2'
async function signup(page, base, email){
  await page.goto(base); await page.evaluate(()=>localStorage.clear()); await page.reload()
  await page.waitForSelector('.login-card, .landing, .home', {timeout:20000})
  if (await page.$('.landing')) { const b=(await page.$('text=Sign in'))||(await page.$('.landing-cta')); if(b) await b.click() }
  await page.waitForSelector('.login-card')
  await page.click('.auth-tabs button:has-text("Create account")')
  await page.fill('input[type=email]', email); await page.fill('input[type=password]','Test123456!')
  await page.click('button[type=submit]:has-text("Create account")')
  await page.waitForSelector('.home', {timeout:20000})
}
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  // --- ADMIN on :3001 ---
  const ap = await browser.newPage({viewport:{width:1400,height:900}})
  await signup(ap, 'http://127.0.0.1:3001', process.env.ADMIN_EMAIL)
  const me = await ap.evaluate(async()=> await (await fetch('/api/me',{headers:{Authorization:'Bearer '+(await window.__sb.auth.getSession()).data.session.access_token}})).json())
  check('admin /api/me isAdmin true', me.isAdmin===true)
  // admin button visible on home
  check('Admin button shows for admin', await ap.$('button:has-text("Admin")')!==null)
  await ap.click('button:has-text("Admin")')
  await ap.waitForSelector(".modal:has-text(\"Admin\")"); await ap.click(".tabs button:has-text(\"Build companies\")"); await ap.waitForSelector(".admin-company-form")
  // add a company
  await ap.fill('.admin-company-form input[placeholder*="Company name"]', 'Blaze Outdoor Builders')
  await ap.fill('.admin-company-form input[placeholder*="Region"]', 'Austin, TX')
  await ap.click('.admin-company-form button:has-text("Add company")')
  await ap.waitForFunction(()=>document.body.textContent.includes('Blaze Outdoor Builders'),{timeout:8000})
  check('company added + listed', true)

  // --- NON-ADMIN on :3000 ---
  const up = await browser.newPage({viewport:{width:1400,height:900}})
  await signup(up, 'http://127.0.0.1:3000', `qa.user.${Date.now()}@gmail.com`)
  const ume = await up.evaluate(async()=> await (await fetch('/api/me',{headers:{Authorization:'Bearer '+(await window.__sb.auth.getSession()).data.session.access_token}})).json())
  check('normal user isAdmin false', ume.isAdmin===false)
  // import → pending (NOT in public shared)
  await up.click('.home-new'); await up.waitForSelector('.wiz'); await up.click('.wiz-head .btn-ghost'); await up.waitForSelector('.topbar')
  await up.click('.tabs button:has-text("Appliances")')
  await up.fill('input[placeholder*="paste"]', TRASH)
  await up.click('.ai-search-row button:has-text("Scan")')
  await up.waitForFunction(()=> (window.__bbq().design.custom??[]).length>0, {timeout:60000})
  const cid = await up.evaluate(()=>window.__bbq().design.custom[0].id)
  const pub = await up.evaluate(async()=> (await (await fetch('/api/catalog/shared')).json()).items)
  check('import is pending (not in public catalog)', !pub.some(a=>a.id===cid))
  check('admin endpoint 403 for normal user', (await up.evaluate(async()=> (await fetch('/api/admin/appliances',{headers:{Authorization:'Bearer '+(await window.__sb.auth.getSession()).data.session.access_token}})).status))===403)
  // remove from my list
  await up.evaluate((id)=>window.__bbq().removeCustomAppliance(id), cid)
  check('removed from personal list', (await up.evaluate(()=>window.__bbq().design.custom.length))===0)
  console.log('cid:', cid)
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
