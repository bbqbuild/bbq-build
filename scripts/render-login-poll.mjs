// Polls the held-open Chromium (CDP :9222) until a Render dashboard session
// exists, then exits 0. Exits 2 after 6 hours without a login.
import { chromium } from 'playwright'

const DEADLINE = Date.now() + 6 * 60 * 60 * 1000

function loggedInUrl(u) {
  if (!u.includes('render.com')) return false
  if (u.includes('/login') || u.includes('/register') || u.includes('/forgot')) return false
  return u.includes('dashboard.render.com')
}

while (Date.now() < DEADLINE) {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    const ctx = browser.contexts()[0]
    if (ctx) {
      const urls = ctx.pages().map((p) => p.url())
      if (urls.some(loggedInUrl)) {
        console.log('LOGGED IN:', urls.find(loggedInUrl))
        await browser.close()
        process.exit(0)
      }
      // backup signal: a session cookie without any dashboard tab open
      const cookies = await ctx.cookies('https://dashboard.render.com')
      if (cookies.some((c) => /sess|auth|token/i.test(c.name) && c.value.length > 20)) {
        console.log('LOGGED IN (session cookie found)')
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
console.log('Timed out waiting for Render login')
process.exit(2)
