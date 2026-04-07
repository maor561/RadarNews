const express = require('express');
const { parseStringPromise } = require('xml2js');
const cors = require('cors');
const https = require('https');
const http = require('http');
const path = require('path');
const iconv = require('iconv-lite');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

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

let sourceHealth = {}; // Track connection status for each source
const itemStore = new Map(); // Accumulates items over time

// --- Cache ---
let feedCache = {
  lastFetch: 0,
  ttl: 10 * 1000 // 10 seconds
};

// --- HTTP/HTTPS Fetcher ---
function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'he,en;q=0.9'
      },
      timeout: timeout
    }, (res) => {
      // Handle redirects
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
        
        // Robust XML cleaning for broken feeds like 0404
        if (url.includes('0404')) {
          // 1. Fix unquoted attributes
          data = data.replace(/ ([\w-:]+)=([^ "'>\s]+)/g, ' $1="$2"');
          // 2. Remove illegal characters/control characters that break XML parsing
          data = data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        }

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

    sourceHealth[source.id] = { status: 'online', lastFetch: Date.now() };

    let items = [];

    // Standard RSS 2.0
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
        sourceLogo: source.logoUrl,
        sourceIcon: source.icon
      }));
    }
    // Atom format
    else if (result.feed && result.feed.entry) {
      const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
      items = entries.map(entry => ({
        title: cleanCDATA(typeof entry.title === 'object' ? (entry.title._ || entry.title['$']?.term || '') : (entry.title || '')),
        link: typeof entry.link === 'object' ? (entry.link['$']?.href || entry.link.href || '') : (entry.link || ''),
        pubDate: entry.published || entry.updated || '',
        description: cleanText(cleanCDATA(typeof entry.summary === 'object' ? (entry.summary._ || '') : (entry.summary || entry.content || ''))),
        source: source.id,
        sourceName: source.nameHe,
        sourceColor: source.color,
        sourceLogo: source.logoUrl,
        sourceIcon: source.icon
      }));
    }
    // RDF format
    else if (result['rdf:rdf'] || result.rdf) {
      const rdf = result['rdf:rdf'] || result.rdf;
      const rawItems = Array.isArray(rdf.item) ? rdf.item : (rdf.item ? [rdf.item] : []);
      items = rawItems.map(item => ({
        title: cleanCDATA(item.title || ''),
        link: cleanCDATA(item.link || ''),
        pubDate: cleanCDATA(item['dc:date'] || item.pubdate || item.pubDate || ''),
        description: cleanText(cleanCDATA(item.description || '')),
        source: source.id,
        sourceName: source.nameHe,
        sourceColor: source.color,
        sourceLogo: source.logoUrl,
        sourceIcon: source.icon
      }));
    }

    // Parse dates and filter valid items
    items = items
      .filter(item => item.title && item.title.trim().length > 0)
      .map(item => {
        let timestamp;
        try {
          timestamp = new Date(item.pubDate).getTime();
          if (isNaN(timestamp)) timestamp = Date.now();
          if (timestamp > Date.now()) timestamp = Date.now(); // Clamp future dates
        } catch {
          timestamp = Date.now();
        }
        return { ...item, timestamp };
      });

    console.log(`✅ ${source.nameHe} (${source.id}): ${items.length} items`);
    return items;

  } catch (err) {
    console.error(`❌ ${source.nameHe} (${source.id}): ${err.message}`);
    sourceHealth[source.id] = { status: 'offline', error: err.message, lastFetch: Date.now() };
    return [];
  }
}

// --- Helpers ---
function cleanCDATA(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function cleanText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// --- Fetch All Feeds ---
// --- Polling Lifecycle ---
async function startRealtimePolling() {
  console.log('\n📡 Initializing Real-time Polling (15s cycle)...');
  
  // First load
  await fetchAllFeedsIncremental();

  setInterval(async () => {
    try {
      const today = new Date().getDate();
      if (today !== currentDay) {
        const pruneThreshold = Date.now() - (3 * 24 * 60 * 60 * 1000);
        let prunedCount = 0;
        for (const [id, item] of itemStore.entries()) {
          if (item.timestamp < pruneThreshold) {
            itemStore.delete(id);
            prunedCount++;
          }
        }
        console.log(`📡 Midnight Pruning: Removed ${prunedCount} items older than 3 days.`);
        currentDay = today;
        await fetchHebrewDate();
      }

      await fetchAllFeedsIncremental();
    } catch(e) {
      console.error('Polling cycle error:', e);
    }
  }, 15000); 
}

async function fetchAllFeedsIncremental() {
  for (const source of FEED_SOURCES) {
    try {
      const fetchedItems = await parseFeed(source);
      let localNewFound = false;
      
      fetchedItems.forEach(item => {
        const key = item.source + '_' + item.title;
        if (!itemStore.has(key)) {
          itemStore.set(key, item);
          localNewFound = true;
        }
      });
      
      // If ANY new news found from THIS source, push update to everyone IMMEDIATELY
      if (localNewFound) {
        console.log(`✨ Direct Push: New items detected from ${source.nameHe}!`);
        broadcastNews();
      }
    } catch (err) {
      console.error(`❌ Fetching ${source.id} failed: ${err.message}`);
    }
  }
}

// Function to get current sorted items
function getSortedItems() {
  return Array.from(itemStore.values()).sort((a,b) => b.timestamp - a.timestamp);
}

// For backward compatibility and API
async function fetchAllFeeds() {
  return getSortedItems();
}

// --- Server-Sent Events (SSE) ---
let clients = [];
let cachedHebrewDate = '';

async function fetchHebrewDate() {
  try {
    const now = new Date();
    const url = `https://www.hebcal.com/converter?cfg=json&gy=${now.getFullYear()}&gm=${now.getMonth()+1}&gd=${now.getDate()}&g2h=1`;
    
    const res = await new Promise((resolve, reject) => {
      https.get(url, (apiRes) => {
        if (apiRes.statusCode !== 200) {
          return reject(new Error(`Status ${apiRes.statusCode}`));
        }
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch(e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    // The response is { "gy":..., "hebrew": "י\"ב בְּתִשְׁרֵי תשפ\"ד", ... }
    cachedHebrewDate = res.hebrew;
    return cachedHebrewDate;
  } catch(e) {
    console.error('Failed to fetch Hebrew date:', e);
    return cachedHebrewDate;
  }
}

function broadcastNews(itemsParam) {
  const items = itemsParam || getSortedItems();
  const todayDDMM = getDDMM(Date.now());
  
  const sources = FEED_SOURCES.map(source => ({
    id: source.id,
    name: source.nameHe,
    domain: source.domain,
    logoUrl: source.logoUrl,
    color: source.color,
    health: sourceHealth[source.id] || { status: 'unknown' },
    count: items.filter(item => getDDMM(item.timestamp) === todayDDMM && item.source === source.id).length
  }));

  const payload = JSON.stringify({
    success: true,
    total: items.length,
    sources: sources,
    lastUpdate: Date.now(),
    items: items.slice(0, 500),
    hebrewDate: cachedHebrewDate
  });

  clients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch(e) {}
  });
}

function getDDMM(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Background poller
let currentDay = new Date().getDate();

startRealtimePolling();

app.get('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  // Send current state instantly
  const todayDDMM = getDDMM(Date.now());
  const currentItems = Array.from(itemStore.values()).sort((a,b) => b.timestamp - a.timestamp);
  const sources = FEED_SOURCES.map(source => ({
    id: source.id,
    name: source.nameHe,
    logoUrl: source.logoUrl,
    domain: source.domain,
    color: source.color,
    health: sourceHealth[source.id] || { status: 'unknown' },
    count: currentItems.filter(item => getDDMM(item.timestamp) === todayDDMM && item.source === source.id).length
  }));

  res.write(`data: ${JSON.stringify({ 
    success: true, 
    total: currentItems.length, 
    sources, 
    lastUpdate: Date.now(), 
    items: currentItems.slice(0, 500),
    hebrewDate: cachedHebrewDate
  })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// --- API Routes ---
app.get('/api/feeds', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const items = await fetchAllFeeds();
    const source = req.query.source;
    const limit = parseInt(req.query.limit) || 200;

    let filtered = items;
    if (source && source !== 'all') {
      filtered = items.filter(item => item.source === source);
    }

    res.json({
      success: true,
      count: filtered.slice(0, limit).length,
      total: filtered.length,
      lastUpdate: new Date(feedCache.lastFetch).toISOString(),
      sources: FEED_SOURCES.map(s => ({
        id: s.id,
        name: s.nameHe,
        color: s.color,
        icon: s.icon,
        count: items.filter(i => i.source === s.id).length
      })),
      items: filtered.slice(0, limit)
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch feeds' });
  }
});

app.get('/api/sources', (req, res) => {
  res.json({
    success: true,
    sources: FEED_SOURCES.map(s => ({
      id: s.id,
      name: s.name,
      nameHe: s.nameHe,
      color: s.color,
      icon: s.icon,
      url: s.url
    }))
  });
});

// Fallback weather data for Tel Aviv
const fallbackWeather = {
  daily: {
    time: Array.from({length: 6}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    }),
    weathercode: [1, 2, 2, 3, 3, 2],
    temperature_2m_max: [28, 27, 26, 25, 24, 26],
    temperature_2m_min: [18, 17, 16, 15, 14, 16]
  }
};

app.get('/api/weather', (req, res) => {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=31.7683&longitude=35.2137&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia/Jerusalem';

  https.get(url, (apiRes) => {
    let data = '';

    apiRes.on('data', chunk => {
      data += chunk;
    });

    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        res.json(parsed);
      } catch(e) {
        console.warn('Weather parsing error, using fallback:', e.message);
        res.json(fallbackWeather);
      }
    });
  }).on('error', (err) => {
    console.warn('Weather API error, using fallback:', err.message);
    res.json(fallbackWeather);
  }).on('timeout', function() {
    console.warn('Weather API timeout, using fallback');
    res.json(fallbackWeather);
    this.destroy();
  }).setTimeout(5000);
});

// --- Fallback to index.html ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`\n🚀 Israel News Aggregator running at http://localhost:${PORT}`);
  console.log(`📡 Sources: ${FEED_SOURCES.map(s => s.nameHe).join(', ')}\n`);

  // Pre-fetch data on startup
  fetchHebrewDate();
  fetchAllFeeds();
});
