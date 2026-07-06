import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com')) || (await ctx.newPage())
if (!page.url().includes('supabase.com')) await page.goto('https://supabase.com/dashboard/sign-in')
await page.waitForTimeout(1000)
const btn = await page.$('text=Continue with GitHub')
if (btn) { await btn.click(); console.log('clicked GitHub') } else console.log('no GitHub button; url=', page.url())
await page.waitForTimeout(4000)
console.log('now at:', page.url())
await page.screenshot({ path: 'screenshots/supabase-github.png' })
const txt = await page.evaluate(() => document.body.innerText.slice(0, 300))
console.log('TEXT:', JSON.stringify(txt))
await browser.close()
