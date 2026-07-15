import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1720, height: 950 } })
p.setDefaultTimeout(120000)
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE:', m.text().slice(0, 200)))
await p.goto('http://127.0.0.1:3000')
await p.fill('input[type=password]', process.env.BBQ_USER_PASSWORD)
await p.click('button[type=submit]')
await p.waitForSelector('.topbar')

// chat: build via assistant
await p.fill('.chat-input input', 'Add a 90cm gas grill with doors under it, a fridge to the right, and a big green egg smoker')
await p.click('.chat-input .btn')
await p.waitForSelector('.chat-op', { timeout: 90000 })
await p.waitForTimeout(1000)
await p.screenshot({ path: 'screenshots/ai-chat.png' })
const ops = await p.$$eval('.chat-op', (els) => els.map((e) => e.textContent))
console.log('OPS:', JSON.stringify(ops))
const frames = await p.evaluate(() => window.__bbq().design.frames.map((f) => `${f.width}${f.lowered ? 'L' : ''}`))
console.log('FRAMES:', JSON.stringify(frames))

// AI check
await p.click('text=🛡 AI Check')
await p.waitForSelector('.validate-report', { timeout: 120000 })
await p.screenshot({ path: 'screenshots/ai-validate.png' })
await p.keyboard.press('Escape')

// product search
await p.click('text=Appliances')
await p.fill('.ai-search-row input', 'Blaze built-in griddle')
await p.click('.ai-search-row .btn')
await p.waitForSelector('.ai-result', { timeout: 120000 })
await p.screenshot({ path: 'screenshots/ai-products.png' })
const results = await p.$$eval('.ai-result strong', (els) => els.map((e) => e.textContent))
console.log('PRODUCTS:', JSON.stringify(results))
// add first product and place it
await p.click('.ai-result >> nth=0 >> .btn-icon')
await p.waitForTimeout(400)
console.log('CUSTOM:', JSON.stringify(await p.evaluate(() => (window.__bbq().design.custom ?? []).map((c) => c.id))))
await b.close()
console.log('done')
