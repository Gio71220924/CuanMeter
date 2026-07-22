const { parseEipoHtml } = require('../ipo-utils');
const { execSync } = require('child_process');

const html = execSync('python ipo_scrape.py', { cwd: process.cwd() }).toString();
console.log('HTML length:', html.length);
console.log('HAS ipo-list:', html.includes('id="ipo-list"'));
console.log('HAS data-key:', html.includes('data-key='));

const items = parseEipoHtml(html);
console.log('Items parsed:', items.length);
if (items.length > 0) {
  console.log('Sample item:', JSON.stringify(items[0], null, 2));
} else {
  // Show what the region looks like
  const idx = html.indexOf('id="ipo-list"');
  console.log('ipo-list idx:', idx);
  if (idx >= 0) {
    console.log('Region around ipo-list:');
    console.log(html.slice(idx, idx + 400));
  } else {
    console.log('First 600 chars of HTML:');
    console.log(html.slice(0, 600));
  }
}
