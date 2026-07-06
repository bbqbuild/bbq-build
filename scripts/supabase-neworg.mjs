import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com')) || (await ctx.newPage())
await page.bringToFront()
await page.goto('https://supabase.com/dashboard/new', { waitUntil: 'domcontentloaded' }).catch(()=>{})
await page.waitForTimeout(3500)
console.log('URL:', page.url())
await page.screenshot({ path: 'screenshots/supabase-neworg.png' })
// list inputs and buttons to understand the form
const inputs = await page.$$eval('input,select,textarea', els => els.map(e => ({tag:e.tagName, type:e.type, name:e.name, id:e.id, placeholder:e.placeholder, ph:e.getAttribute('aria-label')})))
console.log('FIELDS:', JSON.stringify(inputs))
const btns = await page.$$eval('button', els => els.map(e=>e.textContent?.trim()).filter(Boolean).slice(0,20))
console.log('BUTTONS:', JSON.stringify(btns))
await browser.close()
