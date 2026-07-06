import { launch3d, signupFresh } from './_helper.mjs'
const { browser, page: p } = await launch3d()
let fail=0; const check=(n,c)=>{console.log(`${c?'PASS':'FAIL'}  ${n}`); if(!c)fail++}
await signupFresh(p)                       // real account → home, authed
await p.click('.home-new')                 // new kitchen → wizard over builder
await p.waitForSelector('.wiz')
await p.click('.wiz-head .btn-ghost')      // "Start from scratch"
await p.waitForSelector('.topbar')
await p.evaluate(()=>window.__bbq().addFrame(90))
// wait for auto-save to assign a savedId (debounce 1200ms + network)
let savedId=null
for (let i=0;i<20 && savedId===null;i++){ await p.waitForTimeout(500); savedId = await p.evaluate(()=>window.__bbq().savedId) }
check('design auto-saved (has savedId)', savedId!==null)
check('on builder before refocus', await p.$('.topbar')!==null && await p.$('.home')===null)
// simulate a tab refocus: Supabase re-emits SIGNED_IN. setSession fires SIGNED_IN.
await p.evaluate(async ()=>{
  const { data } = await window.__sb.auth.getSession()
  const s = data.session
  await window.__sb.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token })
})
await p.waitForTimeout(1200)
const stillBuilder = await p.evaluate(()=>({ topbar: !!document.querySelector('.topbar'), home: !!document.querySelector('.home') }))
check('stays on the design after refocus (not bounced to home)', stillBuilder.topbar && !stillBuilder.home)
console.log('after refocus:', JSON.stringify(stillBuilder))
await browser.close()
console.log(fail?`\n${fail} FAIL`:'\nALL PASS'); process.exit(fail?1:0)
