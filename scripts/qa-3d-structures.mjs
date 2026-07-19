// 3D smoke test with SwiftShader: two structures must render without the error boundary
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://127.0.0.1:8000'
const OUT = process.env.OUT || 'shots-structures'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
page.setDefaultTimeout(20000)
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
page.on('dialog', (d) => d.accept())
await page.addInitScript(() => localStorage.setItem('bbq_view', '2d'))

await page.goto(BASE)
await page.click('.landing-cta')
await page.waitForSelector('.topbar')
const skip = page.locator('button:has-text("Start from scratch")').first()
if (await skip.isVisible().catch(() => false)) await skip.click()

await page.click('.dock-rail-left .rail-btn:has-text("Presets")')
await page.click('.preset-card:has-text("Weekend Griller")')
await page.waitForTimeout(500)
await page.click('.preset-card:has-text("L-Shape Social")')
await page.waitForSelector('.preset-choice')
await page.click('.choice-card:has-text("Add to this canvas")')
await page.waitForTimeout(600)

// flip to 3D
await page.keyboard.press('v')
await page.waitForTimeout(4000)
const crashed = await page.locator('text=Something went wrong').isVisible().catch(() => false)
console.log(crashed ? 'FAIL: 3D error boundary hit' : '3D rendered OK')
await page.screenshot({ path: `${OUT}/08-3d-structures.png`, timeout: 90000 }).catch(() => console.log('screenshot skipped (software GL too slow)'))
await browser.close()
if (crashed) process.exit(1)
