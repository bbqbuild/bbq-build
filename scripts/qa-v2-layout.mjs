// QA drive of the v2 designer layout (2D view; guest mode)
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://127.0.0.1:8000'
const OUT = process.env.OUT || 'shots-v2'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
page.setDefaultTimeout(15000)
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()))
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await page.addInitScript(() => localStorage.setItem('bbq_view', '2d'))

await page.goto(BASE)
await page.waitForTimeout(500)

// enter as guest
await page.click('.landing-cta')
await page.waitForSelector('.topbar')
// skip the wizard if it shows
const skip = page.locator('button:has-text("Start from scratch")').first()
if (await skip.isVisible().catch(() => false)) await skip.click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/01-default.png` })

// left dock topics
for (const t of ['Ground', 'Presets', 'Frames', 'Appliances']) {
  await page.click(`.dock-rail-left .rail-btn:has-text("${t}")`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/02-left-${t.toLowerCase()}.png` })
}

// add two frames, then select one on canvas → right dock should switch to Edit
await page.click('.dock-rail-left .rail-btn:has-text("Frames")')
await page.waitForTimeout(300)
await page.click('.frame-card >> nth=1')
await page.click('.frame-card >> nth=2')
await page.waitForTimeout(500)
const canvas = page.locator('.canvas-wrap canvas')
const box = await canvas.boundingBox()
await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/03-selection-edit.png` })

// right dock tabs
for (const t of ['Spec', 'Quotes', 'DIY', 'Quality']) {
  await page.click(`.dock-rail-right .rail-btn:has-text("${t}")`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04-right-${t.toLowerCase()}.png` })
}

// collapse both docks — canvas full width
await page.click('.dock-rail-right .rail-btn.active')
await page.click('.dock-rail-left .rail-btn.active')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/05-collapsed.png` })

await browser.close()
console.log('done')
