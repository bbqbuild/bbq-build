import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com/dashboard/account/tokens'))
await page.bringToFront()
await page.fill('input[name="tokenName"]', 'bbq-build-mgmt')
await page.waitForTimeout(400)
const gen = await page.$('button:has-text("Generate token")')
await gen.click()
await page.waitForTimeout(2500)
await page.screenshot({ path:'screenshots/supabase-token-created.png' })
const tok = await page.evaluate(() => {
  const m = document.body.innerText.match(/sbp_[A-Za-z0-9]+/)
  return m ? m[0] : null
})
console.log('MGMT TOKEN:', tok ? tok.slice(0,10)+'…('+tok.length+')' : 'NOT FOUND')
if (tok) {
  const fs = await import('fs')
  fs.appendFileSync('/tmp/mgmt-token.txt', tok)
}
await browser.close()
