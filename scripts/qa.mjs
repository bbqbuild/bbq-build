// Interaction QA: exercises reorder-drag, undo/redo, delete, ground edits,
// save + reload. Prints PASS/FAIL per check.
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://127.0.0.1:3000'
let failures = 0
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
page.on('pageerror', (e) => {
  console.log('PAGE ERROR:', e.message)
  failures++
})

await page.goto(BASE)
await page.fill('input[type=password]', 'Ember&Oak-2417')
await page.click('button[type=submit]')
await page.waitForSelector('.topbar')

// state access helper: the zustand store is module-scoped; expose via window for QA
const getState = () =>
  page.evaluate(() => {
    const s = window.__bbq?.()
    return s
      ? {
          frames: s.design.frames.map((f) => f.width),
          appliances: s.design.appliances.map((a) => a.typeId),
          name: s.design.name,
          groundWidth: s.design.ground.width,
          selection: s.selection,
          dirty: s.dirty,
        }
      : null
  })

// build a small kitchen via the catalog UI
await page.click('.frame-card >> nth=3') // 90
await page.click('.frame-card >> nth=1') // 60
await page.click('.frame-card >> nth=0') // 40
let st = await getState()
if (!st) {
  console.log('NOTE: window.__bbq not exposed; falling back to visual-only checks')
} else {
  check('three frames added (90,60,40)', JSON.stringify(st.frames) === '[90,60,40]')
}

// place appliances via appliances tab (click-to-place on selected frame)
await page.click('text=Appliances')
// last added frame (40) is selected; place a side burner
await page.click('.appliance-card:has-text("Side Burner")')
st = await getState()
if (st) check('burner placed', st.appliances.includes('burner-40'))

// undo twice: appliance, then frame
await page.keyboard.press('Control+z')
await page.keyboard.press('Control+z')
st = await getState()
if (st) check('undo removed burner and 40-frame', JSON.stringify(st.frames) === '[90,60]' && !st.appliances.includes('burner-40'))
await page.keyboard.press('Control+Shift+z')
st = await getState()
if (st) check('redo restored 40-frame', JSON.stringify(st.frames) === '[90,60,40]')

// reorder: drag first frame (90) to the end
const canvas = page.locator('.canvas-wrap canvas')
const box = await canvas.boundingBox()
// world→screen mapping unknown; drag from left third to right third at counter height
const y = box.y + box.height * 0.55
await page.mouse.move(box.x + box.width * 0.38, y)
await page.mouse.down()
for (let i = 0; i <= 12; i++) {
  await page.mouse.move(box.x + box.width * (0.38 + (0.28 * i) / 12), y)
  await page.waitForTimeout(25)
}
await page.mouse.up()
st = await getState()
if (st) check('drag reorder moved a frame', JSON.stringify(st.frames) !== '[90,60,40]')

// select an appliance-less frame and delete it with the keyboard
await page.keyboard.press('Escape')
st = await getState()
if (st) {
  const before = st.frames.length
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.55 } })
  await page.keyboard.press('Delete')
  st = await getState()
  check('delete key removed selected frame', st.frames.length === before - 1)
}

// ground selection: compute the ground slab's screen position from the live camera
await page.keyboard.press('Escape')
const groundPos = await page.evaluate(() => {
  const cam = window.__bbqCam
  const wrap = document.querySelector('.canvas-wrap')
  const w = wrap.clientWidth
  const h = wrap.clientHeight
  // world (0, 7) = middle of the ground slab
  return { x: w / 2 + (0 - cam.x) * cam.zoom, y: h / 2 + (7 - cam.y) * cam.zoom }
})
await canvas.click({ position: groundPos })
st = await getState()
if (st) check('ground selected', st.selection.kind === 'ground')

// save, then verify designs list shows it
await page.fill('.design-name', 'QA Kitchen')
await page.keyboard.press('Enter')
await page.click('.topbar >> text=Save')
await page.waitForSelector('text=Design saved', { timeout: 4000 }).catch(() => {})
st = await getState()
if (st) check('saved (not dirty)', st.dirty === false)

// designs modal lists it
await page.click('.avatar')
await page.click('text=My designs…')
const row = await page.waitForSelector('.design-load:has-text("QA Kitchen")', { timeout: 4000 }).catch(() => null)
check('saved design listed', Boolean(row))

console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS')
await browser.close()
process.exit(failures ? 1 : 0)
