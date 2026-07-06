// Holds a headed Chromium open on DISPLAY :99 (viewable via VNC on :5000)
// at the Render dashboard so Sagi can log in. CDP stays on 127.0.0.1:9222
// so automation can attach later. Keeps running until killed.
import { chromium } from 'playwright'

const ctx = await chromium.launchPersistentContext('/home/sagi/.bbq-render-profile', {
  headless: false,
  viewport: null,
  args: [
    '--remote-debugging-port=9222',
    '--window-size=1440,860',
    '--window-position=0,0',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  env: { ...process.env, DISPLAY: ':99' },
})

const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://dashboard.render.com/login')
console.log('Browser is up. Log in via VNC (vnc://localhost:5000).')

// keep the process alive
await new Promise(() => {})
