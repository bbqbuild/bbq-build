import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find((p) => p.url().includes('/settings')) ?? (await ctx.newPage())
if (!page.url().includes('/settings')) await page.goto('https://dashboard.render.com/settings#api-keys', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
// close any open dialog from previous attempt
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.click('button:has-text("Create API Key")')
await page.waitForTimeout(1500)
await page.screenshot({ path: 'screenshots/render-key-dialog.png' })
const inputs = await page.$$eval('input', (els) =>
  els.map((e) => ({ type: e.type, name: e.name, placeholder: e.placeholder, visible: e.offsetParent !== null, disabled: e.disabled, readOnly: e.readOnly })),
)
console.log(JSON.stringify(inputs, null, 1))
await browser.close()
