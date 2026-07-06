import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com')) || (await ctx.newPage())
await page.bringToFront()
await page.goto('https://supabase.com/dashboard/account/tokens', { waitUntil:'domcontentloaded' }).catch(()=>{})
await page.waitForTimeout(3500)
await page.screenshot({ path:'screenshots/supabase-tokens.png' })
// click generate
const gen = await page.$('button:has-text("Generate")') || await page.$('text=/Generate new token/i')
if (gen) { await gen.click(); await page.waitForTimeout(1200) }
await page.screenshot({ path:'screenshots/supabase-token-dialog.png' })
const btns = await page.$$eval('button', els=>els.map(e=>e.textContent?.trim()).filter(Boolean).slice(0,20))
console.log('BUTTONS:', JSON.stringify(btns))
const inputs = await page.$$eval('input', els=>els.map(e=>({name:e.name,ph:e.placeholder})))
console.log('INPUTS:', JSON.stringify(inputs))
await browser.close()
