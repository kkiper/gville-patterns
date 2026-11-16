// Opens TVA's Guntersville lake-levels page in headless Chrome and records the JSON
// requests the page makes, so the app can read generation schedules directly.
// Run by .github/workflows/discover-tva.yml; writes data/tva-discovery.json.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PAGE = 'https://www.tva.com/environment/lake-levels/guntersville';
const found = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('response', async (res) => {
  const type = res.headers()['content-type'] || '';
  const url = res.url();
  if (!/json/i.test(type) && !/\.json(\?|$)/i.test(url)) return;
  let sample = '';
  try { sample = (await res.text()).slice(0, 1500); } catch { /* body unavailable */ }
  found.push({ url, status: res.status(), type, sample });
});
await page.goto(PAGE, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(5000);
await browser.close();
writeFileSync('data/tva-discovery.json', JSON.stringify({ page: PAGE, at: new Date().toISOString(), found }, null, 1));
console.log(`Recorded ${found.length} JSON responses`);
for (const f of found) console.log(f.status, f.url);
