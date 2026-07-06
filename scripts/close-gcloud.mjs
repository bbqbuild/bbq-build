import { chromium } from 'playwright'
const b = await chromium.connectOverCDP('http://localhost:9222')
const ctx = b.contexts()[0]
for (const p of ctx.pages()) {
  if (p.url().includes('accounts.google.com') || p.url().includes('console.cloud.google')) await p.close().catch(()=>{})
}
await b.close(); console.log('closed')
