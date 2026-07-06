import { launch3d, signupFresh } from './_helper.mjs'
const TRASH = 'https://www.bbqguys.com/i/3082136/turbo-grills/double-trash-drawer-front-to-back-doubletrash-2'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await signupFresh(p)
  await p.click('.home-new'); await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost')
  await p.waitForSelector('.topbar')
  // paste URL + scan
  await p.click(".tabs button:has-text(\"Appliances\")"); await p.waitForSelector("input[placeholder*=\"paste\"]"); await p.fill("input[placeholder*=\"paste\"]", TRASH)
  await p.click('.ai-search-row button:has-text("Scan")')
  // wait for the success toast
  await p.waitForFunction(() => (window.__bbq().design.custom??[]).length>0, { timeout: 60000 })
  const custom = await p.evaluate(()=>window.__bbq().design.custom ?? [])
  check('imported item added with dims', custom.length===1 && custom[0].dims && custom[0].dims.h>0)
  console.log('imported:', JSON.stringify(custom[0]?.dims), custom[0]?.id, 'zone', custom[0]?.zone)
  // shared DB now has it
  const shared = await p.evaluate(async()=> (await (await fetch('/api/catalog/shared')).json()).items)
  check('contributed to shared DB', shared.some(a=>a.id===custom[0].id))
  check('shared item carries cutout dims', shared.find(a=>a.id===custom[0].id)?.dims?.h>0)
  // a fresh visitor loads shared catalog and sees it in the palette
  const p2 = await browser.newPage({ viewport:{width:1400,height:900} })
  await p2.goto('http://127.0.0.1:3000')
  await p2.evaluate(()=>localStorage.clear()); await p2.reload()
  await p2.waitForTimeout(1500)
  const sharedLoaded = await p2.evaluate(()=>window.__bbq().sharedCatalog.map(a=>a.id))
  check('fresh visitor loads shared catalog', sharedLoaded.includes(custom[0].id))
  console.log('fresh sharedCatalog:', JSON.stringify(sharedLoaded))
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
