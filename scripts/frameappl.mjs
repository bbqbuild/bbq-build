import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(() => localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost')
  await p.waitForSelector('.topbar')
  await p.evaluate(() => { const s = window.__bbq(); const f = s.addFrame(60); s.placeAppliance(f, 'sink-40') })
  await p.waitForTimeout(400)
  await p.evaluate(() => window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(300)
  await p.screenshot({ path: 'screenshots/sink60.png', clip: { x: 470, y: 120, width: 1050, height: 620 } })
  await p.evaluate(() => { const s = window.__bbq(); s.setFrameWidth(s.design.frames[0].id, 90) })
  await p.waitForTimeout(400)
  await p.evaluate(() => window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(300)
  await p.screenshot({ path: 'screenshots/sink90.png', clip: { x: 470, y: 120, width: 1050, height: 620 } })
  console.log('shots done')
} catch (e) { console.log('ERR', e.message) }
await browser.close()
