import { chromium } from 'playwright'
const DBPASS = 'F5V3KlXkMyTmKXdCxOxWeBLEdXFe'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages().find(p => p.url().includes('supabase.com/dashboard/new/'))
await page.bringToFront()
await page.fill('input[name="projectName"]', 'bbq-build')
await page.fill('input[name="dbPass"]', DBPASS)
await page.waitForTimeout(600)
await page.screenshot({ path: 'screenshots/supabase-project-filled.png' })
const btn = await page.$('button:has-text("Create new project")')
await btn.click()
await page.waitForTimeout(6000)
console.log('after create URL:', page.url())
await page.screenshot({ path: 'screenshots/supabase-project-creating.png' })
const txt = await page.evaluate(() => document.body.innerText.slice(0, 300))
console.log('TEXT:', JSON.stringify(txt))
await browser.close()
