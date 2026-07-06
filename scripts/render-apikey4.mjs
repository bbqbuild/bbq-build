import { chromium } from 'playwright'
import { appendFileSync } from 'fs'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find((p) => p.url().includes('/settings'))
await page.fill('input[placeholder="name"]', 'bbq-build-deploy')
await page.waitForTimeout(300)
// the dialog's confirm button
const buttons = await page.$$('button')
for (const b of buttons) {
  const t = (await b.textContent())?.trim()
  if (t === 'Create API Key') {
    const inDialog = await b.evaluate((el) => Boolean(el.closest('[role="dialog"], [class*="modal" i], form')))
    if (inDialog) {
      await b.click()
      break
    }
  }
}
await page.waitForTimeout(2000)
await page.screenshot({ path: 'screenshots/render-key-created.png' })
const text = await page.evaluate(() => document.body.innerText)
const m = text.match(/rnd_[A-Za-z0-9_-]+/)
if (m) {
  appendFileSync('.env', `RENDER_API_KEY=${m[0]}\n`)
  console.log('KEY SAVED, prefix:', m[0].slice(0, 8))
} else {
  console.log('KEY NOT FOUND — dialog text follows:')
  console.log(text.slice(0, 600))
}
await page.keyboard.press('Escape')
await browser.close()
