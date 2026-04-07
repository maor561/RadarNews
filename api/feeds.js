const https = require('https');
const { parseStringPromise } = require('xml2js');
const iconv = require('iconv-lite');

// --- Feed Sources Configuration ---
const FEED_SOURCES = [
  {
    id: 'ynet',
    name: 'Ynet',
    nameHe: 'ידיעות אחרונות',
    url: 'https://www.ynet.co.il/Integration/StoryRss1854.xml',
    domain: 'ynet.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=ynet.co.il&sz=128',
    color: '#e81726'
  },
  {
    id: 'walla',
    name: 'Walla',
    nameHe: 'וואלה',
    url: 'https://rss.walla.co.il/feed/22',
    domain: 'walla.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=walla.co.il&sz=128',
    color: '#00aeef'
  },
  {
    id: 'maariv',
    name: 'Maariv',
    nameHe: 'מעריב',
    url: 'https://www.maariv.co.il/rss/rssfeedsmivzakichadashot',
    domain: 'maariv.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=maariv.co.il&sz=128',
    color: '#f7941d'
  },
  {
    id: 'israelhayom',
    name: 'Israel Hayom',
    nameHe: 'ישראל היום',
    url: 'https://www.israelhayom.co.il/rss.xml',
    domain: 'israelhayom.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=israelhayom.co.il&sz=128',
    color: '#003876'
  },
  {
    id: 'rotter',
    name: 'Rotter',
    nameHe: 'רוטר',
    url: 'https://rotter.net/rss/rotternews.xml',
    domain: 'rotter.net',
    logoUrl: 'https://www.google.com/s2/favicons?domain=rotter.net&sz=128',
    color: '#cc0000'
  },
  {
    id: 'globes',
    name: 'Globes',
    nameHe: 'גלובס',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585',
    domain: 'globes.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=globes.co.il&sz=128',
    color: '#0a3d6b'
  },
  {
    id: 'srugim',
    name: 'Srugim',
    nameHe: 'סרוגים',
    url: 'https://www.srugim.co.il/feed',
    domain: 'srugim.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=srugim.co.il&sz=128',
    color: '#2e7d32'
  },
  {
    id: 'now14',
    name: 'Channel 14',
    nameHe: 'ערוץ 14',
    url: 'https://www.now14.co.il/feed/',
    domain: 'now14.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=now14.co.il&sz=128',
    color: '#f05a24'
  },
  {
    id: 'jdn',
    name: 'JDN',
    nameHe: 'JDN חרדי',
    url: 'https://www.jdn.co.il/feed/',
    domain: 'jdn.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=jdn.co.il&sz=128',
    color: '#1565c0'
  },
  {
    id: 'ice',
    name: 'Ice',
    nameHe: 'אייס',
    url: 'https://www.ice.co.il/rss/',
    domain: 'ice.co.il',
    logoUrl: 'https://www.google.com/s2/favicons?domain=ice.co.il&sz=128',
    color: '#004a99'
  }
];

// --- HTTP/HTTPS Fetcher ---
function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : require('http');
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'he,en;q=0.9'
      },
      timeout: timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let data = url.includes('rotter') ? iconv.decode(buffer, 'win1255') : buffer.toString('utf8');
        let sanitizedData = data.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#x?\\d+;|#\\d+;)/g, '&amp;');
        sanitizedData = sanitizedData.replace(/<(?![a-zA-Z\\/!?])/g, '&lt;');
        resolve(sanitizedData);
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// --- Parse RSS/XML Feed ---
async function parseFeed(source) {
  try {
    const xml = await fetchUrl(source.url);
    const result = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
      normalizeTags: false
    });

    let items = [];

    if (result.rss && result.rss.channel) {
      const channel = result.rss.channel;
      const rawItems = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
      items = rawItems.map(item => ({
        title: cleanCDATA(item.title || ''),
        link: cleanCDATA(item.link || ''),
        pubDate: cleanCDATA(item.pubDate || item.pubdate || ''),
        description: cleanText(cleanCDATA(item.description || '')),
        source: source.id,
        sourceName: source.nameHe,
        sourceColor: source.color,
        sourceLogo: source.logoUrl
      }));
    }

    items = items
      .filter(item => item.title && item.title.trim().length > 0)
      .map(item => {
        let timestamp;
        try {
          timestamp = new Date(item.pubDate).getTime();
          if (isNaN(timestamp)) timestamp = Date.now();
          if (timestamp > Date.now()) timestamp = Date.now();
        } catch {
          timestamp = Date.now();
        }
        return { ...item, timestamp };
      });

    return items;
  } catch (err) {
    console.error(`❌ ${source.nameHe}: ${err.message}`);
    return [];
  }
}

function cleanCDATA(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function cleanText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const itemStore = new Map();

    for (const source of FEED_SOURCES) {
      const fetchedItems = await parseFeed(source);
      fetchedItems.forEach(item => {
        const key = item.source + '_' + item.title;
        if (!itemStore.has(key)) {
          itemStore.set(key, item);
        }
      });
    }

    const items = Array.from(itemStore.values()).sort((a, b) => b.timestamp - a.timestamp);
    const source = req.query.source;
    let filtered = items;

    if (source && source !== 'all') {
      filtered = items.filter(item => item.source === source);
    }

    const limit = parseInt(req.query.limit) || 200;

    res.json({
      success: true,
      count: filtered.slice(0, limit).length,
      total: filtered.length,
      lastUpdate: new Date().toISOString(),
      sources: FEED_SOURCES.map(s => ({
        id: s.id,
        name: s.nameHe,
        color: s.color,
        count: items.filter(i => i.source === s.id).length
      })),
      items: filtered.slice(0, limit)
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch feeds' });
  }
};
