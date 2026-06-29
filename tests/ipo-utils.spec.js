const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildIpoResponse,
  parseEipoHtml,
  parseRssIpoItems,
  normalizeItem,
} = require('../ipo-utils.js');

test('buildIpoResponse prefers curated IPO calendar items for production', () => {
  const curated = [
    {
      code: 'ABCD',
      name: 'PT Alpha Beta Tbk',
      stage: 'Book Building',
      price: 'Rp 100 - Rp 120',
      date: '18 - 24 Juni 2026',
      detail: 'https://e-ipo.co.id/id/ipo/abcd',
    },
  ];

  const response = buildIpoResponse({
    curated,
    rssItems: [],
    generatedAt: '2026-06-18T00:00:00.000Z',
  });

  assert.equal(response.status, 'ok');
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0].code, 'ABCD');
  assert.equal(response.items[0].sourceType, 'curated');
  assert.equal(response.source, 'curated');
});

test('parseRssIpoItems extracts IPO alert fields without pretending they are verified', () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>IPO PT Contoh Tbk (CNTO) pasang harga Rp 120 - Rp 150 per saham</title>
        <link>https://example.com/ipo-contoh</link>
        <pubDate>Thu, 18 Jun 2026 08:00:00 GMT</pubDate>
        <description>Book building berlangsung 18-22 Juni 2026. Prospektus ada di e-IPO.</description>
      </item>
    </channel></rss>`;

  const items = parseRssIpoItems(xml, 'Contoh RSS');

  assert.equal(items.length, 1);
  assert.equal(items[0].code, 'CNTO');
  assert.equal(items[0].price, 'Rp 120 - Rp 150');
  assert.equal(items[0].date, 'Thu, 18 Jun 2026 08:00:00 GMT');
  assert.equal(items[0].source, 'Contoh RSS');
  assert.equal(items[0].sourceType, 'rss');
  assert.equal(items[0].unverified, true);
});

test('buildIpoResponse appends RSS alerts only when curated data is absent', () => {
  const response = buildIpoResponse({
    curated: [],
    rssItems: [
      {
        code: 'NEWS',
        name: 'Berita IPO NEWS',
        stage: 'IPO News',
        price: '',
        date: 'Thu, 18 Jun 2026 08:00:00 GMT',
        detail: 'https://example.com/news',
        sourceType: 'rss',
        unverified: true,
      },
    ],
    generatedAt: '2026-06-18T00:00:00.000Z',
  });

  assert.equal(response.items.length, 1);
  assert.equal(response.source, 'rss');
  assert.equal(response.items[0].unverified, true);
});

test('parseEipoHtml keeps structured dates, price range, prospectus, and detail link', () => {
  const html = `
    <section id="ipo-list">
      <div data-key="123">
        <div class="pricing-title"><h3>Book Building</h3></div>
        <img class="img-list" src="/files/logo.png" alt="ABCD">
        <div class="padding5"><h5>PT Alpha Beta Tbk <span>Syariah</span> (ABCD)</h5></div>
        <ul class="pricing-features">
          <li><h5>Harga Penawaran</h5><p>Rp 100 - Rp 120</p></li>
          <li><h5>Periode Book Building</h5><p>18 - 24 Juni 2026</p></li>
          <li><h5>Saham Ditawarkan</h5><p>1.000.000.000 saham</p></li>
        </ul>
        <a href="/id/pipeline/get-propectus-file?id=123">Prospektus</a>
        <a href="/id/ipo/123/abcd">Detail</a>
      </div>
    </section>`;

  const items = parseEipoHtml(html);

  assert.equal(items.length, 1);
  assert.equal(items[0].code, 'ABCD');
  assert.equal(items[0].name, 'PT Alpha Beta Tbk');
  assert.equal(items[0].price, 'Rp 100 - Rp 120');
  assert.equal(items[0].date, '18 - 24 Juni 2026');
  assert.equal(items[0].prospektus, 'https://e-ipo.co.id/id/pipeline/get-propectus-file?id=123');
  assert.equal(items[0].detail, 'https://e-ipo.co.id/id/ipo/123/abcd');
});

test('normalizeItem strips nbsp and replacement chars from price (regression)', () => {
  // e-IPO prices use a non-breaking space that can corrupt to U+FFFD, e.g. "Rp�100".
  const item = normalizeItem({ name: 'PT Test Tbk', price: 'Rp 900 - Rp�1.120' }, 'curated');
  assert.equal(item.price, 'Rp 900 - Rp 1.120');
  assert.ok(!/[ �]/.test(item.price), 'price must not contain nbsp or replacement char');
});

test('parseEipoHtml cleans nbsp/replacement char inside a price cell', () => {
  const html = `
    <section id="ipo-list">
      <div data-key="9">
        <div class="pricing-title"><h3>Book Building</h3></div>
        <img class="img-list" src="/files/x.png" alt="XYZB">
        <div class="padding5"><h5>PT Contoh Tbk (XYZB)</h5></div>
        <ul class="pricing-features">
          <li><h5>Harga Penawaran</h5><p>Rp 100 - Rp�120</p></li>
        </ul>
      </div>
    </section>`;
  const items = parseEipoHtml(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 'Rp 100 - Rp 120');
});
