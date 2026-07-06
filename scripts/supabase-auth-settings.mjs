import { chromium } from 'playwright'
const REF='twakzbszusbinfewvzqr'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com'))
await page.bringToFront()
await page.goto(`https://supabase.com/dashboard/project/${REF}/auth/providers`, { waitUntil:'domcontentloaded' }).catch(()=>{})
await page.waitForTimeout(4000)
await page.screenshot({ path:'screenshots/supabase-auth-providers.png', fullPage:true })
const txt = await page.evaluate(()=>document.body.innerText.slice(0,600))
console.log('URL:', page.url())
console.log('TEXT:', JSON.stringify(txt))
await browser.close()
