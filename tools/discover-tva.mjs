// Opens TVA's Guntersville lake-levels page in headless Chrome and records the JSON
// requests the page makes, so the app can read generation schedules directly.
// Run by .github/workflows/discover-tva.yml; writes data/tva-discovery.json.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PAGE = 'https://www.tva.com/environment/lake-levels/guntersville';
const found = [];
const browser = await chromium.launch();
const page = await browser.newPage();
let docStatus = null;
page.on('response', async (res) => {
  const type = res.headers()['content-type'] || '';
  const url = res.url();
  const kind = res.request().resourceType();
  if (res.request().isNavigationRequest() && !docStatus) docStatus = res.status();
  // Record every background data request (any content type) plus anything that looks like data.
  if (!['xhr', 'fetch'].includes(kind) && !/json|xml|csv/i.test(type)) return;
  let sample = '';
  try { sample = (await res.text()).slice(0, 1500); } catch { /* body unavailable */ }
  found.push({ url, status: res.status(), type, kind, sample });
});
// The page polls continuously, so wait a fixed time rather than for the network to go quiet.
try {
  await page.goto(PAGE, { waitUntil: 'load', timeout: 90000 });
} catch (e) {
  console.log(`page load: ${e.message.split('\n')[0]} (keeping what was captured)`);
}
await page.waitForTimeout(20000);
const title = await page.title().catch(() => null);
const text = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).slice(0, 3000);
const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean)).catch(() => []);
await browser.close();
writeFileSync('data/tva-discovery.json', JSON.stringify({ page: PAGE, at: new Date().toISOString(), docStatus, title, scripts, found, text }, null, 1));
console.log(`document ${docStatus} "${title}"`);
console.log(`Recorded ${found.length} JSON responses`);
for (const f of found) console.log(f.status, f.url);
