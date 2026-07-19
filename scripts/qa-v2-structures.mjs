// QA: preset choice dialog + multi-structure canvas + ground fit (2D, guest)
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://127.0.0.1:8000'
const OUT = process.env.OUT || 'shots-structures'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
page.setDefaultTimeout(15000)
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()))
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
page.on('dialog', (d) => d.accept())
await page.addInitScript(() => localStorage.setItem('bbq_view', '2d'))

await page.goto(BASE)
await page.click('.landing-cta')
await page.waitForSelector('.topbar')
const skip = page.locator('button:has-text("Start from scratch")').first()
if (await skip.isVisible().catch(() => false)) await skip.click()

// open Presets; canvas empty → first preset applies directly, no dialog
await page.click('.dock-rail-left .rail-btn:has-text("Presets")')
await page.waitForTimeout(400)
await page.click('.preset-card:has-text("Weekend Griller")')
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/01-first-preset.png` })

// second preset → choice dialog
await page.click('.preset-card:has-text("L-Shape Social")')
await page.waitForSelector('.preset-choice')
await page.screenshot({ path: `${OUT}/02-choice-dialog.png` })

// add to canvas as an independent structure
await page.click('.choice-card:has-text("Add to this canvas")')
await page.waitForTimeout(800)
await page.keyboard.press('f')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/03-two-structures.png` })

// adding auto-selects the structure — the Edit panel shows the struct editor
await page.screenshot({ path: `${OUT}/04-struct-panel.png` })
// deselect → the summary lists structures; reselect from the list
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.click('.group-list-name:has-text("L-Shape Social")')
await page.waitForTimeout(300)
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// spec covers both structures
await page.click('.dock-rail-right .rail-btn:has-text("Spec")')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/05-spec-both.png` })

// ground fit: enlarge ground first, then fit back down
await page.click('.dock-rail-left .rail-btn:has-text("Ground")')
await page.waitForTimeout(300)
await page.click('button:has-text("Fit ground to kitchen")')
await page.waitForTimeout(500)
await page.keyboard.press('f')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/06-ground-fitted.png` })

// replace flow still works from the dialog
await page.click('.dock-rail-left .rail-btn:has-text("Presets")')
await page.waitForTimeout(300)
await page.click('.preset-card:has-text("U-Shape Bar")')
await page.waitForSelector('.preset-choice')
await page.click('.choice-card:has-text("Replace current kitchen")')
await page.waitForTimeout(800)
await page.keyboard.press('f')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/07-replaced.png` })

await browser.close()
console.log('done')
