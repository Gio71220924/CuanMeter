const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parseEipoHtml } = require('../ipo-utils');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'data', 'ipo-calendar.json');
const SCRAPER = path.join(ROOT, 'ipo_scrape.py');

function runPythonScraper() {
  return new Promise((resolve, reject) => {
    const py = spawn(process.env.PYTHON || 'python', [SCRAPER], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      py.kill();
      reject(new Error('ipo_scrape.py timeout'));
    }, 45000);

    py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    py.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    py.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || `ipo_scrape.py exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function main() {
  const html = await runPythonScraper();
  const items = parseEipoHtml(html);
  if (!items.length) {
    // e-ipo.co.id likely returned a Cloudflare challenge page (common from
    // GitHub Actions datacenter IPs). Skip overwriting the existing file so
    // the last good data is preserved. Exit 0 so the workflow stays green.
    console.warn('[IPO] e-IPO scrape returned 0 structured items — possible Cloudflare block.');
    console.warn('[IPO] Keeping existing ipo-calendar.json unchanged.');
    return;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    source: 'e-ipo.co.id',
    items,
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[IPO] Wrote ${items.length} items to ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((error) => {
  console.error(`[IPO] ${error.message}`);
  process.exit(1);
});
