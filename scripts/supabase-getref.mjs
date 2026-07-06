import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com'))
await page.bringToFront()
// wait until URL contains /project/<ref>
let ref = null
for (let i=0;i<12;i++){
  const u = page.url()
  const m = u.match(/\/project\/([a-z0-9]{15,})/)
  if (m){ ref = m[1]; break }
  await page.waitForTimeout(3000)
}
console.log('project url:', page.url(), '| ref:', ref)
await browser.close()
