import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
await p.goto('http://127.0.0.1:3000')
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_view','2d')})
await p.reload()
await p.waitForSelector('.landing'); await p.click('.landing-cta'); await p.waitForSelector('.topbar')
await p.click('.topbar >> text=Presets')
await p.waitForTimeout(1500)
// measure modal + grid
const info = await p.evaluate(() => {
  const modal = document.querySelector('.modal-wide')
  const grid = document.querySelector('.preset-grid')
  const cards = document.querySelectorAll('.preset-card')
  const cs = getComputedStyle(grid)
  return {
    modalH: modal.clientHeight, modalScrollH: modal.scrollHeight,
    cols: cs.gridTemplateColumns, cards: cards.length,
    firstCardTop: cards[0].getBoundingClientRect().top,
    lastCardTop: cards[cards.length-1].getBoundingClientRect().top,
    modalBottom: modal.getBoundingClientRect().bottom,
  }
})
console.log(JSON.stringify(info, null, 1))
await p.screenshot({ path: 'screenshots/presets-full.png' })
await browser.close()
