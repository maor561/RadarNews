# Claude.md - RadarNews Project

This file documents how to work with Claude on the RadarNews aggregator project.

## 📰 Project Overview

- **Project Name:** RadarNews (מבזקון)
- **Type:** Real-time News Aggregator (Node.js + Express + Vercel)
- **Live URL:** https://radar-news-wine.vercel.app/
- **Repository:** https://github.com/maor561/RadarNews.git

## 🎯 What This Project Does

RadarNews aggregates breaking news from 10+ Hebrew news sources in real-time:
- Ynet, Walla, Maariv, Israel Hayom, Rotter, Globes, Srugim, Channel 14, JDN, Ice

**Features:**
- 📡 Real-time RSS feed polling (15s intervals)
- 🔔 Windows push notifications for new items
- 📱 Fully responsive design (mobile, tablet, desktop)
- 🎨 Dark/light mode with glass-morphism effects
- 🌍 Live updates via polling system
- 📊 363+ aggregated news items
- ⏰ Hebrew date display
- 🌤️ Weather widget
- ✨ Visual "NEW" badge on fresh items (stays until next batch)

## 🏗️ Architecture

### Backend (Vercel Serverless)
- `api/stream.js` - Main RSS aggregator (parallel fetching of all 10 sources)
- `api/feeds.js` - Feed API endpoint
- `api/weather.js` - Weather API proxy
- `api/sources.js` - Source configuration API
- `api/hebrew-date.js` - Hebrew date converter
- `server.js` - Legacy Node.js server (local development)

### Frontend (React-like vanilla JS)
- `public/index.html` - HTML structure with RTL support
- `public/app.js` - Core app logic (polling, notifications, UI updates)
- `public/style.css` - Modern design with CSS variables

### Key Technologies
- **Express.js** - Web server
- **xml2js** - RSS/XML parsing
- **iconv-lite** - Character encoding (Windows-1255 support)
- **Vercel** - Deployment & hosting
- **Vercel Analytics** - Usage tracking

## 💡 How to Work With Claude

### Code Patterns
- **CSS Variables:** Use existing theme variables (--bg-card, --accent, etc.)
- **Responsive Design:** Follow existing breakpoints (600px, 768px, 1024px)
- **Component Updates:** Always update both HTML structure AND styling
- **State Management:** Simple global `state` object in app.js
- **Event Listeners:** Use standard `addEventListener` pattern
- **Async Operations:** Promise-based, minimal error handling (graceful degradation)

### Important Workflow
1. **Always use Git commits** - Never push untested code to main
2. **Test responsiveness** - Check mobile, tablet, and desktop views
3. **Verify notifications** - Test Windows push notifications work
4. **Check Vercel deploys** - Each git push triggers auto-deploy
5. **Keep localhost working** - `npm start` should always work for local dev

## 🔧 Key Files & What They Do

### Backend
- `api/stream.js` - Fetches all 10 RSS feeds **in parallel** (important for speed)
- `server.js` - Local Express server, mirrors API routes

### Frontend (State Management)
- `state.items` - All aggregated news items
- `state.lastItemIds` - Tracks which items have been seen (prevents duplicates)
- `state.newItemIds` - Tracks which items are NEW (visual highlighting)
- `state.disabledSources` - User's disabled news sources (localStorage)
- `state.pushEnabled` - Push notification setting

### UI Components
- **Header** - Logo (110px), live clock, stats, controls
- **Archive Tabs** - LIVE + past 3 days (uses theme variables)
- **Source Tabs** - Toggle between news sources with logos
- **News Cards** - 90px min-height with title, description, metadata
- **Push Notifications** - Windows notifications for new items

## 🎨 Recent UI Updates

- Archive tabs now respect dark/light mode (CSS variables)
- News cards larger (90px → shows descriptions)
- Header optimized (logo 130px → 110px, better spacing)
- Badges professional ("NEW" instead of emoji)
- Smooth transitions & hover effects
- Source badges scale on hover (1.08x)

## ⚠️ Known Quirks & Workarounds

1. **Walla sends IST time as GMT** - Fixed in `api/stream.js` with -3h adjustment
2. **Ice sends no timezone** - Normalized to +0300 in parsing
3. **Vercel timeout 10s** - All fetches run in **parallel** with Promise.all
4. **localStorage persists** - User preferences (disabled sources, theme, sound) survive page reload
5. **NEW badge persists** - Stays until next batch of new items arrives (not on refresh)

## 🚀 Deployment Notes

- **Auto-deploy** - Every push to `main` branch triggers Vercel deploy (~1-2 min)
- **Branch:** Use `main` (not master)
- **Vercel project:** https://vercel.com/maor561s-projects/radar-news
- **Analytics enabled** - Monitor traffic at Vercel dashboard

## 📋 Common Tasks

### Add a new news source
1. Add entry to FEED_SOURCES array in `api/stream.js`
2. Include: id, name, nameHe, url, domain, logoUrl, color
3. Test RSS parsing (some sources have broken XML)
4. Deploy and verify

### Fix timestamps
- Check `api/stream.js` lines 96-115 for timestamp parsing logic
- Some sources send GMT labeled as IST (like Walla)
- Future timestamps are clamped to `Date.now()`

### Modify UI styling
- Use CSS variables (--bg-card, --text-primary, etc.)
- Maintain responsive breakpoints (600px, 768px, 1024px)
- Test dark AND light mode

### Test push notifications
1. Click 🔔 button in header
2. Allow notifications in browser
3. Wait for new items (or check console)
4. Should see Windows notification popup

## 🐛 Debugging Tips

**Console logging:**
```js
// In app.js pollData() - see polling activity
console.log(`📡 Poll: got ${data.items.length} items`);
```

**Check state:**
```js
// Open console (F12)
state.lastItemIds.size  // Number of known items
state.items.length      // Current visible items
state.pushEnabled       // Notification status
```

**Force re-render:**
- Change source filter (archive tab)
- Toggle sound/notifications
- These trigger full re-render

## 📝 Git Workflow

**Branches:**
- `main` - Production (auto-deployed to Vercel)
- `master` - Legacy (don't use)

**Commit style:**
```
git commit -m "Feature: description of change"
git commit -m "Fix: what was broken and how it's fixed"
git commit -m "UI: design improvements"
```

**Never:**
- Force push to main
- Commit without testing
- Skip hooks (--no-verify)

## 🎯 Future Improvements Roadmap

- [ ] Search/filter by keyword
- [ ] Save favorite articles (localStorage)
- [ ] PWA mode (offline reading)
- [ ] Custom notification keywords
- [ ] Article categories/tags
- [ ] Export to CSV/PDF
- [ ] Social sharing buttons
- [ ] Better presentation mode (grid layout)

## 📞 Contact & References

- **GitHub Repo:** https://github.com/maor561/RadarNews
- **Live Site:** https://radar-news-wine.vercel.app/
- **Vercel Dashboard:** https://vercel.com/maor561s-projects/radar-news
- **RSS Sources:** 10 Hebrew news websites aggregated in real-time
