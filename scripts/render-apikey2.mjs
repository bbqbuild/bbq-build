import { chromium } from 'playwright'
import { appendFileSync } from 'fs'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find((p) => p.url().includes('/settings')) ?? (await ctx.newPage())
if (!page.url().includes('/settings')) await page.goto('https://dashboard.render.com/settings#api-keys', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.click('button:has-text("Create API Key")')
await page.waitForTimeout(1200)
// dialog: name input + confirm
const input = await page.$('input[type="text"]:visible, input[name*="name" i]:visible')
if (input) await input.fill('bbq-build-deploy')
await page.screenshot({ path: 'screenshots/render-key-dialog.png' })
// confirm button inside dialog
for (const label of ['Create API Key', 'Create Key', 'Create', 'Generate']) {
  const b = await page.$(`div[role="dialog"] button:has-text("${label}"), form button:has-text("${label}")`)
  if (b) { await b.click(); break }
}
await page.waitForTimeout(1800)
await page.screenshot({ path: 'screenshots/render-key-created.png' })
// find the revealed key (rnd_...)
const text = await page.evaluate(() => document.body.innerText)
const m = text.match(/rnd_[A-Za-z0-9]+/)
if (m) {
  appendFileSync('.env', `\nRENDER_API_KEY=${m[0]}\n`)
  console.log('KEY SAVED (starts with', m[0].slice(0, 8) + '…)')
} else {
  console.log('KEY NOT FOUND in page text')
}
// close dialog
const close = await page.$('div[role="dialog"] button:has-text("Close"), button[aria-label="Close this dialog"]')
if (close) await close.click()
await browser.close()
