import { chromium } from 'playwright'
const REF='twakzbszusbinfewvzqr'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com'))
await page.bringToFront()
await page.goto(`https://supabase.com/dashboard/project/${REF}/auth/providers`, { waitUntil:'domcontentloaded' }).catch(()=>{})
await page.waitForTimeout(3500)
// expand Email provider
const email = await page.$('text=/^Email$/')
if (email) { await email.click().catch(()=>{}); await page.waitForTimeout(1500) }
await page.screenshot({ path:'screenshots/supabase-email-provider.png', fullPage:true })
// look for a "Confirm email" toggle
const labels = await page.$$eval('*', els => els.filter(e=>/confirm email/i.test(e.textContent||'') && e.children.length<3).map(e=>e.textContent.trim().slice(0,40)))
console.log('confirm-email labels:', JSON.stringify([...new Set(labels)].slice(0,5)))
await browser.close()
