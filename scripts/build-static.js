const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const entries = [
  'index.html',
  'CSS',
  'js',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const entry of entries) {
  const source = path.join(rootDir, entry);
  const target = path.join(distDir, entry);

  if (!fs.existsSync(source)) {
    continue;
  }

  fs.cpSync(source, target, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return !base.endsWith('.pkl') && base !== '__pycache__';
    },
  });
}

console.log(`[Build] Static frontend copied to ${distDir}`);
