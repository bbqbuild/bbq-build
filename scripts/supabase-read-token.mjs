import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com/dashboard/account/tokens'))
await page.bringToFront()
await page.waitForTimeout(500)
const found = await page.evaluate(() => {
  const res = {}
  res.inputs = [...document.querySelectorAll('input')].map(i=>i.value).filter(v=>v && v.startsWith('sbp_'))
  const m = document.body.innerText.match(/sbp_[A-Za-z0-9_]+/g)
  res.text = m || []
  // code/pre blocks
  res.code = [...document.querySelectorAll('code,pre,textarea')].map(e=>e.textContent).filter(t=>t&&t.includes('sbp_'))
  return res
})
console.log(JSON.stringify(found))
const full = found.inputs[0] || found.code[0] || found.text[0]
if (full && full.length > 20) { const fs=await import('fs'); fs.writeFileSync('/tmp/mgmt-token.txt', full); console.log('SAVED len', full.length) }
else console.log('token not fully captured')
await browser.close()
