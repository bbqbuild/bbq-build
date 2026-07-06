import { chromium } from 'playwright'
const REF='twakzbszusbinfewvzqr'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com'))
await page.bringToFront()
await page.goto(`https://supabase.com/dashboard/project/${REF}/settings/api-keys`, { waitUntil:'domcontentloaded' }).catch(()=>{})
await page.waitForTimeout(4000)
console.log('URL:', page.url())
await page.screenshot({ path:'screenshots/supabase-apikeys.png', fullPage:true })
// find anon/publishable and service_role/secret keys anywhere in inputs or code
const found = await page.evaluate(() => {
  const out = {}
  // JWT-style keys start with eyJ
  const text = document.body.innerText
  const jwts = [...text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(m=>m[0])
  out.jwtsInText = [...new Set(jwts)]
  const pub = [...text.matchAll(/sb_publishable_[A-Za-z0-9_]+/g)].map(m=>m[0])
  const sec = [...text.matchAll(/sb_secret_[A-Za-z0-9_]+/g)].map(m=>m[0])
  out.publishable = [...new Set(pub)]
  out.secret = [...new Set(sec)]
  // input values
  out.inputs = [...document.querySelectorAll('input')].map(i=>i.value).filter(v=>v && (v.startsWith('eyJ')||v.startsWith('sb_')||v.includes('supabase.co')))
  return out
})
console.log(JSON.stringify(found, null, 1))
await browser.close()
