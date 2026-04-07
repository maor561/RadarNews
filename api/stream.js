const https = require('https');
const { parseStringPromise } = require('xml2js');
const iconv = require('iconv-lite');

const FEED_SOURCES = [
  { id: 'ynet', nameHe: 'ידיעות אחרונות', url: 'https://www.ynet.co.il/Integration/StoryRss1854.xml', domain: 'ynet.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=ynet.co.il&sz=128', color: '#e81726' },
  { id: 'walla', nameHe: 'וואלה', url: 'https://rss.walla.co.il/feed/22', domain: 'walla.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=walla.co.il&sz=128', color: '#00aeef' },
  { id: 'maariv', nameHe: 'מעריב', url: 'https://www.maariv.co.il/rss/rssfeedsmivzakichadashot', domain: 'maariv.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=maariv.co.il&sz=128', color: '#f7941d' },
  { id: 'israelhayom', nameHe: 'ישראל היום', url: 'https://www.israelhayom.co.il/rss.xml', domain: 'israelhayom.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=israelhayom.co.il&sz=128', color: '#003876' },
  { id: 'rotter', nameHe: 'רוטר', url: 'https://rotter.net/rss/rotternews.xml', domain: 'rotter.net', logoUrl: 'https://www.google.com/s2/favicons?domain=rotter.net&sz=128', color: '#cc0000' },
  { id: 'globes', nameHe: 'גלובס', url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585', domain: 'globes.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=globes.co.il&sz=128', color: '#0a3d6b' },
  { id: 'srugim', nameHe: 'סרוגים', url: 'https://www.srugim.co.il/feed', domain: 'srugim.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=srugim.co.il&sz=128', color: '#2e7d32' },
  { id: 'now14', nameHe: 'ערוץ 14', url: 'https://www.now14.co.il/feed/', domain: 'now14.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=now14.co.il&sz=128', color: '#f05a24' },
  { id: 'jdn', nameHe: 'JDN חרדי', url: 'https://www.jdn.co.il/feed/', domain: 'jdn.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=jdn.co.il&sz=128', color: '#1565c0' },
  { id: 'ice', nameHe: 'אייס', url: 'https://www.ice.co.il/rss/', domain: 'ice.co.il', logoUrl: 'https://www.google.com/s2/favicons?domain=ice.co.il&sz=128', color: '#004a99' }
];

function decodeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

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

async function parseFeed(source) {
  try {
    const xml = await fetchUrl(source.url);
    const result = await parseStringPromise(xml, { explicitArray: false, trim: true, normalizeTags: false });
    let items = [];

    if (result.rss && result.rss.channel) {
      const channel = result.rss.channel;
      const rawItems = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
      items = rawItems.map(item => ({
        title: decodeHtml(item.title || ''),
        link: (item.link || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        pubDate: (item.pubDate || item.pubdate || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        description: decodeHtml((item.description || '').replace(/<[^>]*>/g, '')),
        source: source.id,
        sourceName: source.nameHe,
        sourceColor: source.color,
        sourceLogo: source.logoUrl
      }));
    }

    return items.filter(item => item.title).map(item => {
      let timestamp;
      try {
        const raw = item.pubDate || '';
        // Fix Ice format: "2026/04/07 14:07:03" -> add +0300
        const normalized = raw.match(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/)
          ? raw.replace(/\//g, '-') + ' +0300'
          : raw;
        timestamp = new Date(normalized).getTime();
        if (isNaN(timestamp)) timestamp = Date.now();

        const now = Date.now();
        if (timestamp > now) {
          // Source sent IST time labeled as GMT - subtract 3 hours
          const istFixed = timestamp - 3 * 60 * 60 * 1000;
          timestamp = istFixed > now ? now : istFixed;
        }
      } catch { timestamp = Date.now(); }
      return { ...item, timestamp };
    });
  } catch (err) {
    return [];
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'application/json');

  try {
    const itemStore = new Map();

    // Fetch all sources in parallel instead of sequentially
    const results = await Promise.all(FEED_SOURCES.map(source => parseFeed(source)));
    results.forEach(fetchedItems => {
      fetchedItems.forEach(item => {
        const key = item.source + '_' + item.title;
        if (!itemStore.has(key)) {
          itemStore.set(key, item);
        }
      });
    });

    const items = Array.from(itemStore.values()).sort((a, b) => b.timestamp - a.timestamp);
    const todayDDMM = new Date().toLocaleDateString('he-IL');

    const sources = FEED_SOURCES.map(source => ({
      id: source.id,
      name: source.nameHe,
      domain: source.domain,
      logoUrl: source.logoUrl,
      color: source.color,
      health: { status: 'online' },
      count: items.filter(item => item.source === source.id).length
    }));

    res.json({
      success: true,
      total: items.length,
      sources: sources,
      lastUpdate: Date.now(),
      items: items.slice(0, 500),
      hebrewDate: todayDDMM
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
