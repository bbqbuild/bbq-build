import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
p.on('console', m => m.type()==='error' && console.log('CONSOLE:', m.text().slice(0,200)))
p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)))
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','2d')})
await p.reload()
await p.waitForSelector('.landing')
await p.click('.landing-cta')
await p.waitForSelector('.topbar')
await p.click('.topbar >> text=Presets')
await p.waitForTimeout(1500)
const cards = await p.$$('.preset-card')
console.log('preset cards in DOM:', cards.length)
// also test priceBreakdown/computeScene per preset directly
const errs = await p.evaluate(() => {
  const out = []
  // can't import; rely on any thrown errors already logged
  return out
})
await browser.close()
