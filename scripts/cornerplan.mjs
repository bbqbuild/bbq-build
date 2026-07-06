import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(() => localStorage.clear()); await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost')
  await p.waitForSelector('.topbar')
  await p.evaluate(() => { const s = window.__bbq(); s.addFrame(90); s.addCornerUnit('diagonal'); s.addFrame(60, undefined, false, 'right'); s.setCornerAppliance('right', 'gozney-dome'); if (s.viewMode === '3d') s.toggleView() })
  await p.waitForTimeout(700)
  await p.evaluate(() => window.dispatchEvent(new Event('bbq:fit'))); await p.waitForTimeout(500)
  await p.screenshot({ path: 'screenshots/cornerplan-diag.png' })
  console.log('done')
} catch (e) { console.log('ERR', e.message) }
await browser.close()
