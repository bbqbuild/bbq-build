import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
console.time('goto'); await p.goto('http://127.0.0.1:3000'); console.timeEnd('goto')
console.time('shot'); await p.screenshot({ path: 'screenshots/mini.png', animations: 'disabled', timeout: 60000 }); console.timeEnd('shot')
await b.close(); console.log('ok')
