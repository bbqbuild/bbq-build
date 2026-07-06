import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com/dashboard')) || ctx.pages().find(p=>p.url().includes('supabase.com'))
await page.bringToFront()
await page.waitForTimeout(1500)
console.log('URL:', page.url())
await page.screenshot({ path: 'screenshots/supabase-state.png' })
const txt = await page.evaluate(() => document.body.innerText.slice(0, 500))
console.log('TEXT:', JSON.stringify(txt))
await browser.close()
