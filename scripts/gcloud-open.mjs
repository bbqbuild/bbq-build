import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = await ctx.newPage()
await page.goto('https://console.cloud.google.com/apis/credentials', { waitUntil:'domcontentloaded' }).catch(e=>console.log('nav:',e.message.split('\n')[0]))
await page.waitForTimeout(6000)
console.log('URL:', page.url())
await page.screenshot({ path:'screenshots/gcloud-1.png' })
const txt = await page.evaluate(()=>document.body.innerText.slice(0,300))
console.log('TEXT:', JSON.stringify(txt))
await browser.close()
