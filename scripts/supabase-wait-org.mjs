import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com'))
await page.bringToFront()
for (let i=0;i<10;i++){
  await page.waitForTimeout(3000)
  const u = page.url()
  if (!u.endsWith('/dashboard/new')) { console.log('moved to:', u); break }
  console.log('still at new, attempt', i)
}
await page.screenshot({ path: 'screenshots/supabase-org-result.png' })
console.log('final URL:', page.url())
const txt = await page.evaluate(() => document.body.innerText.slice(0, 400))
console.log('TEXT:', JSON.stringify(txt))
await browser.close()
