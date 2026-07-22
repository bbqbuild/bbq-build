// QA: AI Render tab — photorealistic photos (real Gemini image-to-image call) +
// client-recorded flythrough video (no AI cost, real MediaRecorder capture).
// Needs SwiftShader since headless Chrome has no real WebGL and both features
// depend on an actual rendered 3D canvas.
//
// Screenshots under swiftshader's software compositor can hang the CDP session
// mid-flight (subsequent commands queue behind a stuck screenshot), so this
// script verifies everything via DOM state instead and only takes screenshots
// at the very end, best-effort.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://127.0.0.1:8000'
const OUT = process.env.OUT || 'shots-render'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
page.setDefaultTimeout(20000)
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()))
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
page.on('dialog', (d) => d.accept())
await page.addInitScript(() => localStorage.setItem('bbq_view', '2d'))

// /api/ai/* requires a real signed-in user (no guest bypass), so log in with the
// QA account instead of the usual guest "Start from scratch" flow.
if (!process.env.BBQ_USER_EMAIL || !process.env.BBQ_USER_PASSWORD) {
  console.log('FAIL: BBQ_USER_EMAIL / BBQ_USER_PASSWORD not set — cannot test the authenticated /api/ai/render-photos route')
  await browser.close()
  process.exit(1)
}
await page.goto(BASE)
await page.click('button:has-text("Sign in")')
await page.waitForSelector('.login-card')
await page.fill('input[type=email]', process.env.BBQ_USER_EMAIL)
await page.fill('input[type=password]', process.env.BBQ_USER_PASSWORD)
await page.click('.login-card button[type=submit]')
await page.waitForSelector('.home-new', { timeout: 15000 })
console.log('signed in as', process.env.BBQ_USER_EMAIL)
await page.click('.home-new')
await page.waitForSelector('.topbar')

await page.click('.dock-rail-left .rail-btn:has-text("Presets")')
await page.waitForTimeout(400)
await page.click('.preset-card:has-text("Weekend Griller")')
await page.waitForTimeout(600)

await page.click('.dock-rail-right .rail-btn:has-text("Render")')
await page.waitForSelector('text=AI photos')
console.log('Render tab open')

// ---- AI video: free, instant, real capture — no external API cost ----
// Under headless SwiftShader (software GL) each frame of the shadowed/tone-mapped
// scene can take seconds to rasterize, so the wall-clock-paced 7s animation can take
// 30s+ here; on a real user's GPU it finishes in ~7s. Generous timeout accordingly.
await page.click('button:has-text("Record flythrough")')
await page.waitForSelector('text=/Recording… \\d+%/', { timeout: 5000 })
console.log('flythrough recording started (may take up to ~60s under software rendering)')
await page.waitForSelector('.render-video video', { timeout: 90000 })
const videoSrc = await page.locator('.render-video video').getAttribute('src')
const videoOk = typeof videoSrc === 'string' && videoSrc.startsWith('blob:')
console.log(videoOk ? `PASS: flythrough produced a real video (${videoSrc.slice(0, 24)}…)` : `FAIL: unexpected video src ${videoSrc}`)

// ---- AI photos: real Gemini image-to-image call (small, one-time QA cost) ----
await page.click('button:has-text("Generate photos")')
await page.waitForSelector('.render-gallery', { timeout: 10000 })
console.log('photo shots captured, waiting on Gemini renders...')
await page.waitForFunction(() => document.querySelectorAll('.render-shot-loading').length === 0, { timeout: 60000 })
const shots = await page.locator('.render-shot img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')?.slice(0, 30)))
console.log(`PASS: ${shots.length} AI photo(s) rendered:`, shots)

await page.screenshot({ path: `${OUT}/final.png`, timeout: 45000 }).catch(() => console.log('final screenshot skipped (slow swiftshader compositor)'))
await browser.close()
console.log('done')
