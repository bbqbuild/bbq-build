// Exits 0 once a Supabase dashboard (signed-in) tab is detected.
import { chromium } from 'playwright'
const DEADLINE = Date.now() + 60 * 60 * 1000
function signedIn(u) {
  return u.includes('supabase.com/dashboard') && !u.includes('/sign-in') && !u.includes('/sign-up')
}
while (Date.now() < DEADLINE) {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    const ctx = browser.contexts()[0]
    const urls = ctx.pages().map(p => p.url())
    const hit = urls.find(signedIn)
    if (hit) { console.log('SUPABASE SIGNED IN:', hit); await browser.close(); process.exit(0) }
    await browser.close()
  } catch (e) { console.log('poll:', e.message.split('\n')[0]) }
  await new Promise(r => setTimeout(r, 12000))
}
process.exit(2)
