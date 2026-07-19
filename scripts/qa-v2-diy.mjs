// One-off: verify the right-dock DIY tab → "DIY the whole kitchen" opens the DIY portal
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://127.0.0.1:8000'
const OUT = process.env.OUT || 'shots-v2'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
page.setDefaultTimeout(15000)
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await page.addInitScript(() => localStorage.setItem('bbq_view', '2d'))

await page.goto(BASE)
await page.click('.landing-cta')
await page.waitForSelector('.topbar')
const skip = page.locator('button:has-text("Start from scratch")').first()
if (await skip.isVisible().catch(() => false)) await skip.click()

// build something first (Frames is the default-open topic; only open if closed)
const framesBtn = page.locator('.dock-rail-left .rail-btn:has-text("Frames")')
if (!(await framesBtn.getAttribute('class')).includes('active')) await framesBtn.click()
await page.click('.frame-card >> nth=0')
await page.click('.frame-card >> nth=1')
await page.waitForTimeout(400)

// DIY tab → whole-kitchen project → portal
await page.click('.dock-rail-right .rail-btn:has-text("DIY")')
await page.waitForTimeout(300)
await page.click('text=DIY the whole kitchen')
await page.waitForSelector('.diy-start')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/06-diy-portal.png` })

// back to the builder — the project should now be listed under the DIY tab
await page.click('text=← Back')
await page.waitForSelector('.topbar')
await page.click('.dock-rail-right .rail-btn:has-text("DIY")')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/07-diy-listed.png` })

await browser.close()
console.log('done')
