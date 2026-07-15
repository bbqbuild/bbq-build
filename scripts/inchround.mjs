import { launch3d } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await p.goto('http://127.0.0.1:3000')
  await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('bbq_unit','imperial')})
  await p.reload()
  await p.waitForSelector('.landing'); await p.click('.landing-cta')
  await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  const fid = await p.evaluate(()=>{ const s=window.__bbq(); const f=s.addFrame(80,undefined,true); s.select({kind:'frame',id:f}); return f })
  await p.waitForSelector('.panel .slider-row input.size-input')
  // type 36 into the Width input and blur
  const widthInput = (await p.$$('.panel .slider-row input.size-input'))[0]
  await widthInput.click({clickCount:3})
  await widthInput.type('36')
  await widthInput.press('Enter')
  await p.waitForTimeout(300)
  const st = await p.evaluate((id)=>{ const f=window.__bbq().design.frames.find(x=>x.id===id); return { cm: f.width } }, fid)
  check('stored as 91.44 cm (exactly 36")', Math.abs(st.cm-91.44)<0.01)
  const shown = await p.evaluate(()=>document.querySelector('.panel .slider-row input.size-input').value)
  check('input reads back 36"', shown.trim()==='36"')
  const header = await p.$eval('.panel h2', e=>e.textContent)
  check('header shows 3′/36″ (not 35¾″)', /3′|36/.test(header) && !/35/.test(header))
  console.log('cm:', st.cm, '| input:', shown, '| header:', header.trim())
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
