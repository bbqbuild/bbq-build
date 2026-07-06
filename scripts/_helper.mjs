// Shared test helpers for the Supabase-auth era.
import { chromium } from 'playwright'

export async function launch3d() {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1720, height: 950 } })
  page.setDefaultTimeout(60000)
  page.on('dialog', (d) => d.accept())
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
  return { browser, page }
}

/** Sign up a fresh account and land on the home dashboard. */
export async function signupFresh(page, base = 'http://127.0.0.1:3000') {
  await page.goto(base)
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('bbq_view', '3d') })
  await page.reload()
  await page.waitForSelector('.login-card, .landing, .home', { timeout: 20000 })
  if (await page.$('.landing')) {
    // landing page → go to auth
    const btn = (await page.$('text=Sign in')) || (await page.$('.landing-cta'))
    if (btn) await btn.click()
  }
  if (await page.$('.login-card')) {
    await page.click('.auth-tabs button:has-text("Create account")')
    const email = `qa.${Date.now()}.${Math.floor(Math.random() * 1e4)}@gmail.com`
    await page.fill('input[type=email]', email)
    await page.fill('input[type=password]', 'Test123456!')
    await page.click('button[type=submit]:has-text("Create account")')
  }
  await page.waitForSelector('.home', { timeout: 20000 })
}

/** From home, open a new design in the builder. */
export async function enterBuilder(page) {
  await page.click('.home-new')
  await page.waitForSelector('.topbar', { timeout: 15000 })
}
