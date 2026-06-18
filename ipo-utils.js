const fs = require('fs');

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value) {
  return decodeEntities(String(value || '').replace(/<[^>]+>/g, ' '));
}

function pickTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return decodeEntities((block.match(re) || [])[1] || '');
}

function extractCode(text) {
  const bracket = String(text || '').match(/\(([A-Z]{2,5})\)/);
  if (bracket) return bracket[1];
  const ticker = String(text || '').match(/\b([A-Z]{3,5})\b(?=\s*(?:Tbk|IPO|melantai|listing|saham))/i);
  return ticker ? ticker[1].toUpperCase() : '';
}

function extractPrice(text) {
  const value = String(text || '').replace(/\s+/g, ' ');
  const range = value.match(/Rp\s*[\d.,]+(?:\s*(?:-|sampai|hingga|–)\s*Rp?\s*[\d.,]+)?/i);
  if (!range) return '';
  return range[0]
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*–\s*/g, ' - ')
    .trim();
}

function normalizeItem(item, sourceType) {
  const code = String(item.code || '').trim().toUpperCase();
  const name = stripTags(item.name || item.title || '');
  const detail = String(item.detail || item.link || '').trim();
  return {
    id: String(item.id || code || detail || name),
    code,
    name,
    stage: stripTags(item.stage || (sourceType === 'rss' ? 'IPO News' : '')),
    syariah: Boolean(item.syariah),
    logo: item.logo || null,
    prospektus: item.prospektus || null,
    detail,
    closed: Boolean(item.closed),
    priceLabel: item.priceLabel || (item.price ? 'Harga' : ''),
    price: stripTags(item.price || ''),
    dateLabel: item.dateLabel || (item.date ? 'Tanggal' : ''),
    date: stripTags(item.date || ''),
    sector: stripTags(item.sector || ''),
    lot: stripTags(item.lot || ''),
    info: stripTags(item.info || ''),
    source: item.source || '',
    sourceType,
    unverified: Boolean(item.unverified),
  };
}

function parseRssIpoItems(xml, source = 'RSS') {
  const items = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  let match;
  while ((match = itemRe.exec(String(xml || '')))) {
    const block = match[0];
    const title = stripTags(pickTag(block, 'title'));
    const description = stripTags(pickTag(block, 'description'));
    const link = stripTags(pickTag(block, 'link'));
    const pubDate = stripTags(pickTag(block, 'pubDate'));
    const text = `${title} ${description}`;
    if (!/ipo|initial public offering|e-ipo|melantai|listing/i.test(text)) continue;

    const code = extractCode(text);
    items.push(normalizeItem({
      id: link || title,
      code,
      name: title,
      stage: 'IPO News',
      price: extractPrice(text),
      date: pubDate,
      detail: link,
      info: description,
      source,
      unverified: true,
    }, 'rss'));
  }
  return items.slice(0, 8);
}

function parseEipoHtml(html, baseUrl = 'https://e-ipo.co.id') {
  const out = [];
  const listIdx = String(html || '').indexOf('id="ipo-list"');
  const region = listIdx >= 0 ? String(html || '').slice(listIdx) : String(html || '');
  const parts = region.split(/data-key="(\d+)"/).slice(1);
  for (let i = 0; i < parts.length; i += 2) {
    const id = parts[i];
    const chunk = parts[i + 1] || '';
    const stage = stripTags((chunk.match(/pricing-title[^>]*>\s*<h3>([\s\S]*?)<\/h3>/) || [])[1]);
    const logoMatch = chunk.match(/img-list"\s+src="([^"]+)"\s+alt="([^"]*)"/);
    const logo = logoMatch ? baseUrl + logoMatch[1].replace(/&amp;/g, '&') : null;
    const code = logoMatch ? logoMatch[2] : '';
    const nameBlock = (chunk.match(/padding5">\s*<h5[^>]*>([\s\S]*?)<\/h5>/) || [])[1] || '';
    const syariah = /Syariah/i.test(nameBlock);
    let name = stripTags(nameBlock.replace(/<span[\s\S]*?<\/span>/gi, ''));
    if (code) name = name.replace(new RegExp('\\(\\s*' + code + '\\s*\\)'), '').trim();

    const fields = [];
    const features = (chunk.match(/pricing-features">([\s\S]*?)<\/ul>/) || [])[1] || '';
    const liRe = /<li>\s*<h5[^>]*>([\s\S]*?)<\/h5>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/g;
    let match;
    while ((match = liRe.exec(features))) {
      const label = stripTags(match[1]);
      const value = stripTags(match[2]);
      if (!label || /prospektus/i.test(label)) continue;
      if (value) fields.push({ label, value });
    }

    const prospectusMatch = chunk.match(/href="(\/id\/pipeline\/get-propectus-file[^"]*)"/);
    const detailMatch = chunk.match(/href="(\/id\/ipo\/[^"]+)"/);
    const pick = (re) => fields.find((field) => re.test(field.label)) || {};
    const priceField = pick(/harga/i);
    const dateField = pick(/periode|tanggal/i);

    if (code || name) {
      out.push(normalizeItem({
        id,
        code,
        name,
        stage,
        syariah,
        logo,
        prospektus: prospectusMatch ? baseUrl + prospectusMatch[1].replace(/&amp;/g, '&') : null,
        detail: detailMatch ? baseUrl + detailMatch[1].replace(/&amp;/g, '&') : `${baseUrl}/id/home`,
        closed: /closed|selesai|pencatatan|listing/i.test(stage),
        priceLabel: priceField.label || '',
        price: priceField.value || '',
        dateLabel: dateField.label || '',
        date: dateField.value || '',
        sector: pick(/sektor/i).value || '',
        lot: pick(/saham ditawarkan|ditawarkan/i).value || '',
        info: pick(/informasi/i).value || '',
      }, 'curated'));
    }
  }
  return out.slice(0, 12);
}

function readCuratedIpoCalendar(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => normalizeItem(item, 'curated'))
      .filter((item) => item.code || item.name || item.detail)
      .slice(0, 12);
  } catch {
    return [];
  }
}

function buildIpoResponse({ curated = [], rssItems = [], generatedAt } = {}) {
  const selected = curated.length ? curated : rssItems;
  const source = curated.length ? 'curated' : (rssItems.length ? 'rss' : 'none');
  return {
    status: 'ok',
    generated_at: generatedAt || new Date().toISOString(),
    items: selected
      .map((item) => normalizeItem(item, item.sourceType || source))
      .filter((item) => item.code || item.name || item.detail)
      .slice(0, 12),
    source,
    disclaimer: source === 'rss'
      ? 'Data IPO dari RSS berita sebagai alert awal dan belum diverifikasi. Cek prospektus/e-IPO sebelum mengambil keputusan.'
      : 'Data IPO dikurasi dari e-IPO/berita resmi. Bukan rekomendasi - baca prospektus sebelum memesan.',
  };
}

module.exports = {
  buildIpoResponse,
  decodeEntities,
  extractCode,
  extractPrice,
  normalizeItem,
  parseEipoHtml,
  parseRssIpoItems,
  readCuratedIpoCalendar,
  stripTags,
};
