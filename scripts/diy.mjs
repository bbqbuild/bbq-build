import { launch3d, signupFresh } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
try {
  await signupFresh(p)                                    // auth needed for AI calls
  await p.click('.home-new'); await p.waitForSelector('.wiz'); await p.click('.wiz-head .btn-ghost'); await p.waitForSelector('.topbar')
  // build a section: santa maria + lowered primo table + doors base
  const ids = await p.evaluate(()=>{
    const s=window.__bbq()
    const a=s.addFrame(90); s.placeAppliance(a,'santamaria-90')
    const b=s.addFrame(80,undefined,true); s.placeAppliance(b,'primo-xl')
    const c=s.addFrame(60); s.placeAppliance(c,'doors-60')
    return {a,b,c}
  })
  await p.waitForTimeout(400)
  // multi-select via real shift-clicks in 3D
  const rect = await p.evaluate(()=>{const c=document.querySelector('.stage3d, canvas').getBoundingClientRect(); return {x:c.x,y:c.y}})
  await p.evaluate((id)=>window.__bbq().select({kind:'frame',id}), ids.a)
  await p.evaluate((id)=>window.__bbq().toggleMultiSelect(id), ids.b)
  await p.evaluate((id)=>window.__bbq().toggleMultiSelect(id), ids.c)
  const sel = await p.evaluate(()=>window.__bbq().selection)
  check('multi-selection of 3 frames', sel.kind==='multi' && sel.ids.length===3)
  // MultiPanel visible → name + group
  await p.waitForSelector('.panel input.text-input', {timeout:5000})
  await p.fill('.panel input.text-input', 'Smoker corner')
  await p.click('.panel button:has-text("Group these frames")')
  await p.waitForTimeout(300)
  const g = await p.evaluate(()=>window.__bbq().design.groups)
  check('group created with 3 frames', g?.length===1 && g[0].frameIds.length===3 && g[0].name==='Smoker corner')
  check('group panel selected', await p.evaluate(()=>window.__bbq().selection.kind)==='group')
  // DIY button → portal
  await p.click('.panel button:has-text("DIY")')
  await p.waitForSelector('.diy-page', {timeout:6000})
  check('DIY portal opens', await p.$('.diy-page')!==null)
  check('project listed in nav', (await p.$eval('.admin-nav', e=>e.textContent)).includes('Smoker corner'))
  await p.screenshot({ path:'screenshots/diy-start.png' })
  // generate with defaults (grounded AI — allow up to 3 min)
  await p.click('button:has-text("Skip questions")')
  await p.waitForSelector('.diy-plan-head', {timeout:200000})
  check('plan generated', await p.$('.diy-plan-head')!==null)
  const text = await p.$eval('.admin-content', e=>e.textContent)
  check('has shopping list', /Shopping list/.test(text))
  check('has tools', /Tools/.test(text))
  check('has build steps', /Build steps/.test(text))
  check('has structure notes', /Structure/.test(text))
  check('has utilities or counter', /Utility|Countertop/.test(text))
  // progress tracking
  await p.click('.diy-checklist input')
  await p.waitForTimeout(400)
  const pct = await p.$eval('.diy-progress strong', e=>e.textContent)
  check('progress updates on checkbox', pct !== '0%')
  console.log('progress:', pct)
  await p.screenshot({ path:'screenshots/diy-plan.png' })
  // back to designer keeps design
  await p.click('button:has-text("Back to the designer")')
  await p.waitForSelector('.topbar')
  check('back to builder, design intact', await p.evaluate(()=>window.__bbq().design.frames.length)===3)
  check('DIY button now in topbar', await p.$('.topbar button:has-text("DIY")')!==null)
} catch(e){ console.log('ERR', e.message); fail++ }
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
