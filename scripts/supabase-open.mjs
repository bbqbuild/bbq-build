import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = await ctx.newPage()
await page.goto('https://supabase.com/dashboard/projects', { waitUntil: 'domcontentloaded' }).catch(e => console.log('nav:', e.message.split('\n')[0]))
await page.waitForTimeout(4000)
console.log('URL:', page.url())
await page.screenshot({ path: 'screenshots/supabase-1.png', fullPage: false })
// dump some visible text to understand state
const txt = await page.evaluate(() => document.body.innerText.slice(0, 400))
console.log('TEXT:', JSON.stringify(txt))
await browser.close()
