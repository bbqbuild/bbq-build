import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com/dashboard/new/'))
await page.bringToFront()
await page.waitForTimeout(1500)
const inputs = await page.$$eval('input,select,textarea', els => els.map(e => ({tag:e.tagName, type:e.type, name:e.name, id:e.id, placeholder:e.placeholder, aria:e.getAttribute('aria-label'), val:e.value?.slice(0,30)})))
console.log('FIELDS:', JSON.stringify(inputs, null, 1))
const btns = await page.$$eval('button', els => els.map(e=>e.textContent?.trim()).filter(Boolean).slice(0,25))
console.log('BUTTONS:', JSON.stringify(btns))
await browser.close()
