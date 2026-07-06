// Screenshot harness: drives the app through the main flows and captures PNGs.
// Usage: node scripts/shoot.mjs [baseUrl]
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.argv[2] || 'http://127.0.0.1:3000'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
page.setDefaultTimeout(120000)
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()))
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

await page.goto(BASE)
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/01-login.png` })

// login
await page.fill('input[type=password]', process.env.BBQ_PW || 'Ember&Oak-2417')
await page.click('button[type=submit]')
await page.waitForSelector('.topbar', { timeout: 5000 })
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/02-empty.png` })

// open presets, apply Chef's Island
await page.click('text=✨ Presets')
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/03-presets.png` })
await page.click('text=Chef\'s Island')
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/04-chefs-island.png` })

// select the middle frame (click canvas center area)
const canvas = page.locator('.canvas-wrap canvas')
const box = await canvas.boundingBox()
await canvas.click({ position: { x: box.width / 2, y: box.height * 0.62 } })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/05-frame-selected.png` })

// spec sheet
await page.click('text=Spec ·')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/06-spec.png` })
await page.keyboard.press('Escape')

// add a frame from Structure tab
await page.click('text=Structure')
await page.click('.frame-card >> nth=1')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/07-frame-added.png` })

// appliances tab with a frame selected
await page.click('text=Appliances')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/08-appliances-tab.png` })

// save
await page.click('.topbar >> text=Save')
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/09-saved.png` })

console.log('done')
await browser.close()
