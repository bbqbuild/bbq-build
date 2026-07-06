// Exits 0 once a tab lands on aistudio.google.com (i.e. Google login done).
import { chromium } from 'playwright'
const DEADLINE = Date.now() + 6 * 60 * 60 * 1000
while (Date.now() < DEADLINE) {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    const ctx = browser.contexts()[0]
    if (ctx) {
      const hit = ctx.pages().map((p) => p.url()).find((u) => u.includes('aistudio.google.com') && !u.includes('accounts.google.com'))
      if (hit) {
        console.log('GOOGLE LOGGED IN:', hit)
        await browser.close()
        process.exit(0)
      }
    }
    await browser.close()
  } catch (e) {
    console.log('poll:', e.message.split('\n')[0])
  }
  await new Promise((r) => setTimeout(r, 20000))
}
process.exit(2)
