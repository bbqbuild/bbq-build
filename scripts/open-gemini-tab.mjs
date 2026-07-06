import { chromium } from 'playwright'
const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const existing = ctx.pages().find(p => p.url().includes('aistudio.google.com'))
if (!existing) {
  const page = await ctx.newPage()
  await page.goto('https://aistudio.google.com/apikey').catch(e => console.log('nav:', e.message.split('\n')[0]))
  console.log('Gemini tab open at:', page.url())
} else {
  console.log('Tab already open:', existing.url())
}
await browser.close()
