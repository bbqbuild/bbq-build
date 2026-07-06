import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = await ctx.newPage()
await page.goto('https://dashboard.render.com/settings#api-keys', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
await page.screenshot({ path: 'screenshots/render-settings.png', fullPage: false })
console.log('URL:', page.url())
// try to find the API keys section
const btn = await page.$$eval('button', (els) => els.map((e) => e.textContent?.trim()).filter(Boolean))
console.log('BUTTONS:', JSON.stringify(btn.slice(0, 40)))
await browser.close()
