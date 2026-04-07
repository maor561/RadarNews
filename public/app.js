// ============================================
// Israel News Aggregator - Frontend App
// ============================================

(function () {
  'use strict';

  // --- State ---
  let state = {
    items: [],
    sources: [],
    activeSource: 'all',
    soundEnabled: true,
    pushEnabled: localStorage.getItem('push-notifications') === 'on',
    isDark: true,
    lastItemIds: new Set(),
    refreshInterval: 10, // seconds
    refreshTimer: null,
    progressTimer: null,
    isFirstLoad: true,
    isPresentationMode: false,
    pendingData: null,
    presentationPage: 0,
    presentationInterval: null,
    activeDate: 'live', // 'live' or 'DD/MM'
    disabledSources: JSON.parse(localStorage.getItem('disabled-sources') || '[]')
  };

  // --- DOM Refs ---
  const dom = {
    tickerTrack: document.getElementById('tickerTrack'),
    clockTime: document.getElementById('clockTime'),
    clockDate: document.getElementById('clockDate'),
    totalCount: document.querySelector('#totalCount .stat-number'),
    sourcesCount: document.querySelector('#sourcesCount .stat-number'),
    sourceTabs: document.getElementById('sourceTabs'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    newsFeed: document.getElementById('newsFeed'),
    lastUpdateText: document.getElementById('lastUpdateText'),
    soundToggle: document.getElementById('soundToggle'),
    themeToggle: document.getElementById('themeToggle'),
    presentationToggle: document.getElementById('presentationToggle'),
    refreshBtn: document.getElementById('refreshBtn'),
    hebrewDate: document.getElementById('hebrewDate'),
    weatherWidget: document.getElementById('weatherWidget'),
    qrContainer: document.getElementById('qrContainer'),
    qrImage: document.getElementById('qrImage'),
    archiveBar: document.getElementById('archiveBar'),
    sourceSettingsBtn: document.getElementById('sourceSettingsBtn'),
    sourcePanel: document.getElementById('sourcePanel'),
    sourcePanelOverlay: document.getElementById('sourcePanelOverlay'),
    sourcePanelClose: document.getElementById('sourcePanelClose'),
    sourcePanelBody: document.getElementById('sourcePanelBody'),
    enableAllSources: document.getElementById('enableAllSources'),
    disableAllSources: document.getElementById('disableAllSources'),
    pushToggle: document.getElementById('pushToggle')
  };

  // --- Clock ---
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    dom.clockTime.textContent = `${hours}:${minutes}:${seconds}`;

    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    dom.clockDate.textContent = `יום ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  // --- Format Time Ago ---
  function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דק'`;
    if (hours < 24) return `לפני ${hours} שע'`;
    if (days < 7) return `לפני ${days} ימים`;
    return new Date(timestamp).toLocaleDateString('he-IL');
  }

  // --- Format Time ---
  function formatTime(timestamp) {
    return new Intl.DateTimeFormat('he-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(timestamp));
  }

  // --- Ticker ---
  function updateTicker(items) {
    const tickerItems = items.slice(0, 20);
    const html = tickerItems.map(item => `
      <div class="ticker-item">
        <span class="ticker-source" style="background: ${item.sourceColor}">${item.sourceName}</span>
        <span class="ticker-title">${escapeHtml(item.title)}</span>
      </div>
      <span class="ticker-separator">◆</span>
    `).join('');

    // Duplicate for seamless loop
    dom.tickerTrack.innerHTML = html + html;
  }

  // --- Weather ---
  async function fetchWeather() {
    try {
      const response = await fetch('/api/weather');
      const data = await response.json();
      
      const current = data.daily;
      const days = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
      
      const getIcon = (code) => {
        if (code === 0) return '☀️';
        if (code <= 3) return '🌤️';
        if (code <= 48) return '🌫️';
        if (code <= 55) return '🌦️';
        if (code <= 65) return '🌧️';
        if (code <= 75) return '❄️';
        if (code <= 82) return '🌦️';
        return '⛈️';
      };

      let html = `
        <div class="weather-current">
          ${getIcon(current.weathercode[0])}
          <span>${Math.round(current.temperature_2m_max[0])}°</span>
        </div>
        <div class="weather-forecast">
      `;

      for (let i = 1; i < 6; i++) {
        const date = new Date(data.daily.time[i]);
        html += `
          <div class="forecast-day">
            <span>${days[date.getDay()]}</span>
            <span class="forecast-icon">${getIcon(current.weathercode[i])}</span>
            <span class="forecast-temp">${Math.round(current.temperature_2m_max[i])}°</span>
          </div>
        `;
      }

      html += '</div>';
      dom.weatherWidget.innerHTML = html;
    } catch (err) {
      console.error('Weather error:', err);
    }
  }

  // --- Source Tabs ---
  function renderSourceTabs(sources) {
    // Keep the "all" tab
    const allTab = dom.sourceTabs.querySelector('[data-source="all"]');
    
    // Remove existing dynamic tabs
    dom.sourceTabs.querySelectorAll('.source-tab:not([data-source="all"])').forEach(el => el.remove());

    const sourceData = {
      'ynet': { name: 'ידיעות אחרונות', icon: '📰' },
      'walla': { name: 'וואלה', icon: '🌐' },
      'maariv': { name: 'מעריב', icon: '🗞️' },
      'israelhayom': { name: 'ישראל היום', icon: '🇮🇱' },
      'rotter': { name: 'רוטר', icon: '⚡' },
      'n12': { name: 'N12 / מאקו', icon: '📺' },
      'kan': { name: 'כאן חדשות', icon: '🇮🇱' },
      'now14': { name: 'ערוץ 14', icon: '🔥' },
      'news0404': { name: '0404', icon: '🛡️' },
      'ice': { name: 'אייס', icon: '❄️' },
      'haaretz': { name: 'הארץ', icon: '✒️' },
      'mako': { name: 'מאקו', icon: '⭐' }
    };

    sources.forEach(source => {
      const info = sourceData[source.id] || { name: source.name || 'מקור', icon: '📰' };
      const domain = source.domain;
      const initials = (info.name || source.nameHe || 'מ').charAt(0);
      const mainLogo = source.logoUrl;
      const health = source.health || { status: 'unknown' };

      const tab = document.createElement('button');
      tab.className = `source-tab compact ${health.status === 'offline' ? 'offline' : ''}`;
      tab.setAttribute('data-source', source.id);
      tab.id = `tab-${source.id}`;
      tab.title = info.name || source.nameHe; // Show name on hover only

      tab.innerHTML = `
        <div class="tab-logo-container">
          <span class="status-indicator status-${health.status}" title="${health.error || ''}"></span>
          ${mainLogo ? `<img src="${mainLogo}" class="tab-logo" alt="${info.name}" data-domain="${domain}" data-initials="${initials}">` : `<span class="tab-initials">${initials}</span>`}
        </div>
        <span class="tab-count" id="count-${source.id}">0</span>
      `;
      tab.addEventListener('click', () => setActiveSource(source.id));
      dom.sourceTabs.appendChild(tab);
    });

    // Update the "all" tab click handler
    allTab.addEventListener('click', () => setActiveSource('all'));
    
    updateActiveTab();
  }

  // --- Date Helpers ---
  function getDDMM(timestamp) {
    const d = new Date(timestamp);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function renderArchiveTabs() {
    const dates = [];
    const now = new Date();
    
    // Add "LIVE"
    dates.push({ id: 'live', label: 'LIVE' });
    
    // Add last 3 days starting from Yesterday
    for (let i = 1; i <= 3; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const id = getDDMM(d.getTime());
      dates.push({ id: id, label: `${id} ארכיון` });
    }

    dom.archiveBar.innerHTML = '';
    dates.forEach(date => {
      const btn = document.createElement('button');
      btn.className = `archive-tab ${date.id === 'live' ? 'live' : ''} ${state.activeDate === date.id ? 'active' : ''}`;
      btn.textContent = date.label;
      btn.addEventListener('click', () => {
        state.activeDate = date.id;
        renderArchiveTabs();
        updateCounters();
        renderNewsFeed(state.items);
      });
      dom.archiveBar.appendChild(btn);
    });
  }

  // --- Set Active Source ---
  function setActiveSource(sourceId) {
    state.activeSource = sourceId;
    updateActiveTab();
    renderNewsFeed(state.items);
  }

  function updateActiveTab() {
    dom.sourceTabs.querySelectorAll('.source-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-source') === state.activeSource);
    });
  }

  // --- Render News Feed ---
  function renderNewsFeed(items) {
    const now = Date.now();
    let filtered = items.map(item => ({
      ...item,
      timestamp: item.timestamp > now ? now : item.timestamp
    }));

    // 0. Filter out disabled sources
    if (state.disabledSources.length > 0) {
      filtered = filtered.filter(item => !state.disabledSources.includes(item.source));
    }

    // 1. Filter by Date
    if (state.activeDate !== 'live') {
      filtered = filtered.filter(item => getDDMM(item.timestamp) === state.activeDate);
    }
    
    // 2. Filter by Source
    if (state.activeSource !== 'all') {
      filtered = filtered.filter(item => item.source === state.activeSource);
    }

    // 3. Strict Sorting: Always newest first (highest timestamp)
    filtered.sort((a, b) => {
      const diff = b.timestamp - a.timestamp;
      if (diff !== 0) return diff;
      return b.title.localeCompare(a.title);
    });

    if (filtered.length === 0) {
      dom.newsFeed.innerHTML = `
        <div class="no-items">
          <span class="no-items-icon">📭</span>
          <p>אין מבזקים להצגה</p>
        </div>
      `;
      return;
    }

    const newItemIds = new Set(filtered.map(item => item.title + item.source));

    // Limit to 10 items in Presentation Mode as requested
    const itemsToRenderFinal = state.isPresentationMode ? filtered.slice(0, 10) : filtered;

    dom.newsFeed.innerHTML = itemsToRenderFinal.map((item, index) => {
      const isNew = !state.isFirstLoad && !state.lastItemIds.has(item.title + item.source);
      
      // Keywords for high-impact alerts
      const criticalKeywords = ['צבע אדום', 'חדירת מחבלים', 'פיגוע', 'התרעה'];
      const isCritical = criticalKeywords.some(kw => item.title.includes(kw));

      // Get Logo
      const sourceInfo = state.sources.find(s => s.id === item.source);
      const mainLogoUrl = item.sourceLogo || (sourceInfo ? sourceInfo.logoUrl : null);
      const fallbackFavicon = sourceInfo && sourceInfo.domain ? `https://www.google.com/s2/favicons?domain=${sourceInfo.domain}&sz=64` : '';
      const initials = (item.sourceName || 'מ').charAt(0);

      if (isNew && state.soundEnabled) {
        playNotificationSound();
      }

      return `
        <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer"
           class="news-item ${isNew ? 'is-new' : ''} ${isCritical ? 'critical-alert' : ''}"
           style="--item-color: ${item.sourceColor};"
           id="news-item-${index}">
          <div class="item-source">
            <div class="source-badge">
              ${mainLogoUrl 
                ? `<img src="${mainLogoUrl}" class="source-img" data-domain="${sourceInfo?.domain || ''}" data-initials="${initials}">` 
                : `<span class="badge-initials">${initials}</span>`}
            </div>
            <span class="source-name-small">${escapeHtml(item.sourceName)}</span>
          </div>
          <div class="item-content">
            <div class="item-title">${escapeHtml(item.title)}</div>
            <div class="item-description">${item.description ? escapeHtml(truncate(item.description, 100)) : ''}</div>
            <div class="item-meta">
              <span class="item-time">
                <span class="time-icon">🕐</span>
                <span>${formatTime(item.timestamp)}</span>
                <span>·</span>
                <span>${timeAgo(item.timestamp)}</span>
              </span>
              <span class="item-link-icon">←</span>
            </div>
          </div>
        </a>
      `;
    }).join('');

    state.lastItemIds = newItemIds;
  }

  function playNotificationSound() {
    // Only play once per batch of new items to avoid noise
    if (state.lastSoundTime && Date.now() - state.lastSoundTime < 2000) return;
    state.lastSoundTime = Date.now();
    
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.2;
    audio.play().catch(() => {});
  }



  // --- Source Initials ---
  function getSourceInitials(name) {
    const map = {
      'ידיעות אחרונות': 'Y',
      'וואלה': 'W',
      'מאקו / N12': 'N12',
      'הארץ': 'הא',
      'מעריב': 'מע',
      'ישראל היום': 'IH',
      'רוטר': 'R',
      'כיפה': 'כ'
    };
    return map[name] || name.charAt(0);
  }

  // --- Fetch News (Polling instead of SSE for Vercel) ---
  function connectStream() {
    dom.loadingState.style.display = 'flex';
    dom.errorState.style.display = 'none';
    dom.newsFeed.style.display = 'none';

    const pollData = async () => {
      try {
        const response = await fetch('/api/stream');
        const data = await response.json();

        if (!data.success) return;

        // Detect new items
        let newItems = [];
        if (!state.isFirstLoad) {
          newItems = data.items.filter(item => !state.lastItemIds.has(item.title + item.source));
        }

        state.pendingData = data;

        // Send push BEFORE applying (before lastItemIds updates)
        if (!state.isFirstLoad && newItems.length > 0) {
          if (state.soundEnabled) playNotificationSound();
          newItems.forEach(item => sendPushNotification(item));
        }

        // Always apply - so new items always appear at the top
        applyPendingItems();

        if (data.hebrewDate) {
          dom.hebrewDate.textContent = data.hebrewDate;
        }

        if (state.isFirstLoad) {
          renderArchiveTabs();
          renderSourceTabs(data.sources);
          applyDisabledSources();
          updateCounters();
          dom.loadingState.style.display = 'none';
          dom.newsFeed.style.display = 'flex';
          state.isFirstLoad = false;
        } else {
          updateSourceHealth(data.sources);
          updateCounters();
        }

        const updateTime = new Date(data.lastUpdate);
        dom.lastUpdateText.textContent = `עדכון אחרון: ${formatTime(updateTime.getTime())}`;
      } catch(err) {
        console.error('Stream error:', err);
      }
    };

    // Initial fetch
    pollData();

    // Poll every 15 seconds
    setInterval(pollData, 15000);
  }

  // --- Update Counters (Dynamic per Day) ---
  function updateCounters() {
    const items = state.items;
    const todayDDMM = getDDMM(Date.now());
    
    // Update individual source counts (for today only to show real flow)
    state.sources.forEach(source => {
      const count = items.filter(i => getDDMM(i.timestamp) === todayDDMM && i.source === source.id).length;
      const countEl = document.getElementById(`count-${source.id}`);
      if (countEl) countEl.textContent = count;
    });

    // Update global stats - same logic as "all" tab: today only, excluding disabled
    let currentFeed = items.filter(i => !state.disabledSources.includes(i.source));
    if (state.activeDate !== 'live') {
      currentFeed = currentFeed.filter(i => getDDMM(i.timestamp) === state.activeDate);
    } else {
      currentFeed = currentFeed.filter(i => getDDMM(i.timestamp) === todayDDMM);
    }

    if (dom.totalCount) dom.totalCount.textContent = currentFeed.length;
    
    // Update sources count (active sources only)
    const activeSources = state.sources.filter(s => !state.disabledSources.includes(s.id));
    if (dom.sourcesCount) dom.sourcesCount.textContent = activeSources.length;
    
    // Update count in "All" tab (today, excluding disabled)
    const allCountEl = document.getElementById('count-all');
    if (allCountEl) {
      const todayTotal = items.filter(i => getDDMM(i.timestamp) === todayDDMM && !state.disabledSources.includes(i.source)).length;
      allCountEl.textContent = todayTotal;
    }
  }

  function updateSourceHealth(sources) {
    sources.forEach(source => {
      const tab = document.getElementById(`tab-${source.id}`);
      if (tab) {
        const health = source.health || { status: 'unknown' };
        tab.classList.toggle('offline', health.status === 'offline');
        
        const indicator = tab.querySelector('.status-indicator');
        if (indicator) {
          indicator.className = `status-indicator status-${health.status}`;
          indicator.title = health.error || (health.status === 'online' ? 'מחובר ותקין' : '');
        }
      }
    });
  }

  // --- Auto Refresh ---
  function startAutoRefresh() {
    // Clear existing timers
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    if (state.progressTimer) clearInterval(state.progressTimer);

    let elapsed = 0;
    const total = state.refreshInterval;

    // Progress bar update
    state.progressTimer = setInterval(() => {
      elapsed++;
      const percent = (elapsed / total) * 100;
      dom.refreshProgress.style.width = `${percent}%`;

      if (elapsed >= total) {
        elapsed = 0;
        dom.refreshProgress.style.width = '0%';
        fetchNews(true); // background fetch
      }
    }, 1000);
  }

  // --- Apply Pending Items ---
  function applyPendingItems() {
    if (!state.pendingData) return;
    const data = state.pendingData;
    
    // Force deep update of items
    const now = Date.now();
    state.items = data.items.map(item => ({
      ...item,
      timestamp: item.timestamp > now ? now : item.timestamp
    }));
    state.sources = [...data.sources];
    state.pendingData = null;
    
    updateCounters();
    
    renderNewsFeed(state.items);

    // Update lastItemIds to mark all as seen (for next poll)
    const allItems = Array.from(state.items).filter(i => !state.disabledSources.includes(i.source));
    state.lastItemIds = new Set(allItems.map(item => item.title + item.source));

    // Always scroll to top on live view so new items are visible
    if (state.activeDate === 'live') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- Sound ---
  let audioContext = null;
  function initAudio() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
      dom.soundToggle.classList.remove('pulse-attention');
    }
  }

  // Global Audio Unlocker for Chrome Autoplay
  function unlockAudio() {
    initAudio();
    // One-time triggers to satisfy gesture requirement
    const events = ['mousedown', 'touchstart', 'keydown'];
    events.forEach(e => document.removeEventListener(e, unlockAudio));
    console.log('🔊 Audio Unlocked');
  }
  document.addEventListener('mousedown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('keydown', unlockAudio);

  function playNotificationSound() {
    if (!state.soundEnabled) return;
    
    try {
      if (!audioContext || audioContext.state === 'suspended') {
        dom.soundToggle.classList.add('pulse-attention');
        return;
      }
      initAudio();

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.setValueAtTime(880, audioContext.currentTime);
      osc.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.15, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.warn('Sound failed:', e);
    }
  }

  // --- Theme Toggle ---
  function toggleTheme() {
    state.isDark = !state.isDark;
    document.body.classList.toggle('dark-mode', state.isDark);
    document.body.classList.toggle('light-mode', !state.isDark);

    const darkIcon = dom.themeToggle.querySelector('.theme-dark');
    const lightIcon = dom.themeToggle.querySelector('.theme-light');
    darkIcon.style.display = state.isDark ? 'inline' : 'none';
    lightIcon.style.display = state.isDark ? 'none' : 'inline';

    localStorage.setItem('news-theme', state.isDark ? 'dark' : 'light');
  }

  // --- Presentation Mode Toggle ---
  function togglePresentationMode() {
    state.isPresentationMode = !state.isPresentationMode;
    
    if (state.isPresentationMode) {
      dom.presentationToggle.style.background = 'var(--accent)';
      dom.presentationToggle.style.color = 'white';
      document.body.classList.add('presentation-mode');
      
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      } catch(e) {}
      
      applyPendingItems();
    } else {
      dom.presentationToggle.style.background = 'var(--bg-glass)';
      dom.presentationToggle.style.color = 'var(--text-secondary)';
      document.body.classList.remove('presentation-mode');
      
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen();
        }
      } catch(e) {}
    }
  }

  // --- Push Notifications ---
  function updatePushBtn() {
    if (!dom.pushToggle) return;
    const onIcon = dom.pushToggle.querySelector('.push-on');
    const offIcon = dom.pushToggle.querySelector('.push-off');
    const isOn = state.pushEnabled && Notification.permission === 'granted';
    onIcon.style.display = isOn ? 'inline' : 'none';
    offIcon.style.display = isOn ? 'none' : 'inline';
    dom.pushToggle.style.outline = isOn ? '2px solid var(--accent)' : '';
  }

  async function togglePush() {
    if (!('Notification' in window)) {
      alert('הדפדפן שלך לא תומך בהתראות');
      return;
    }

    if (state.pushEnabled) {
      // Turn off
      state.pushEnabled = false;
      localStorage.setItem('push-notifications', 'off');
      updatePushBtn();
      return;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      state.pushEnabled = true;
      localStorage.setItem('push-notifications', 'on');
      new Notification('מבזקון', {
        body: 'התראות מבזקים הופעלו!',
        icon: '/favicon.png'
      });
    } else {
      state.pushEnabled = false;
      localStorage.setItem('push-notifications', 'off');
      alert('לא ניתן להפעיל התראות - נא לאשר גישה בהגדרות הדפדפן');
    }
    updatePushBtn();
  }

  function sendPushNotification(item) {
    if (!state.pushEnabled) return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return; // Only when tab is not focused

    try {
      const n = new Notification(item.sourceName + ' | מבזקון', {
        body: item.title,
        icon: item.sourceLogo || '/favicon.png',
        badge: '/favicon.png',
        tag: item.source + '_' + item.title.slice(0, 30), // avoid duplicates
        renotify: false
      });
      n.onclick = () => {
        window.focus();
        if (item.link) window.open(item.link, '_blank');
        n.close();
      };
    } catch(e) {}
  }

  // --- Sound Toggle ---
  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const onIcon = dom.soundToggle.querySelector('.sound-on');
    const offIcon = dom.soundToggle.querySelector('.sound-off');
    onIcon.style.display = state.soundEnabled ? 'inline' : 'none';
    offIcon.style.display = state.soundEnabled ? 'none' : 'inline';

    localStorage.setItem('news-sound', state.soundEnabled ? 'on' : 'off');
    
    if (state.soundEnabled) playNotificationSound();
  }

  // --- Helpers ---
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  }
  // --- Source Management Panel ---
  function openSourcePanel() {
    renderSourcePanel();
    dom.sourcePanel.classList.add('active');
    dom.sourcePanelOverlay.classList.add('active');
  }

  function closeSourcePanel() {
    dom.sourcePanel.classList.remove('active');
    dom.sourcePanelOverlay.classList.remove('active');
  }

  function renderSourcePanel() {
    dom.sourcePanelBody.innerHTML = '';
    
    state.sources.forEach(source => {
      const isEnabled = !state.disabledSources.includes(source.id);
      const health = source.health || { status: 'unknown' };
      const statusText = health.status === 'online' ? '🟢' : health.status === 'offline' ? '🔴' : '⚪';
      
      const row = document.createElement('div');
      row.className = `source-toggle-row ${isEnabled ? '' : 'disabled'}`;
      row.innerHTML = `
        <img src="${source.logoUrl || ''}" class="source-toggle-logo" alt="${source.name}"
             onerror="this.src='https://www.google.com/s2/favicons?domain=${source.domain}&sz=64'">
        <div class="source-toggle-info">
          <span class="source-toggle-name">${statusText} ${source.name || source.id}</span>
          <span class="source-toggle-domain">${source.domain || ''}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${isEnabled ? 'checked' : ''} data-source-id="${source.id}">
          <span class="toggle-slider"></span>
        </label>
      `;
      
      const checkbox = row.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', (e) => {
        toggleSource(source.id, e.target.checked);
        row.classList.toggle('disabled', !e.target.checked);
      });
      
      dom.sourcePanelBody.appendChild(row);
    });
  }

  function toggleSource(sourceId, enabled) {
    if (enabled) {
      state.disabledSources = state.disabledSources.filter(id => id !== sourceId);
    } else {
      if (!state.disabledSources.includes(sourceId)) {
        state.disabledSources.push(sourceId);
      }
    }
    localStorage.setItem('disabled-sources', JSON.stringify(state.disabledSources));
    
    // Hide/show the source tab
    const tab = document.getElementById(`tab-${sourceId}`);
    if (tab) tab.style.display = enabled ? '' : 'none';
    
    // If the currently active source was disabled, reset to 'all'
    if (!enabled && state.activeSource === sourceId) {
      setActiveSource('all');
    }
    
    updateCounters();
    renderNewsFeed(state.items);
  }

  function setAllSources(enabled) {
    if (enabled) {
      state.disabledSources = [];
    } else {
      state.disabledSources = state.sources.map(s => s.id);
    }
    localStorage.setItem('disabled-sources', JSON.stringify(state.disabledSources));
    
    // Update all tabs visibility
    state.sources.forEach(source => {
      const tab = document.getElementById(`tab-${source.id}`);
      if (tab) tab.style.display = enabled ? '' : 'none';
    });
    
    if (!enabled) setActiveSource('all');
    
    renderSourcePanel();
    updateCounters();
    renderNewsFeed(state.items);
  }

  function applyDisabledSources() {
    // Hide tabs of disabled sources on load
    state.disabledSources.forEach(sourceId => {
      const tab = document.getElementById(`tab-${sourceId}`);
      if (tab) tab.style.display = 'none';
    });
  }

  // --- Load Preferences & Init QR ---
  function loadPreferences() {
    const url = window.location.href;
    dom.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;

    const theme = localStorage.getItem('news-theme');
    if (theme === 'light') {
      state.isDark = false;
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      dom.themeToggle.querySelector('.theme-dark').style.display = 'none';
      dom.themeToggle.querySelector('.theme-light').style.display = 'inline';
    }

    const sound = localStorage.getItem('news-sound');
    if (sound === 'on') {
      state.soundEnabled = true;
      dom.soundToggle.querySelector('.sound-on').style.display = 'inline';
      dom.soundToggle.querySelector('.sound-off').style.display = 'none';
    }
  }

  // --- Init ---
  function init() {
    // Global Image Error Handler (Centralized to avoid HTML inline quote issues)
    window.addEventListener('error', function (e) {
      if (e.target.tagName === 'IMG' && (e.target.classList.contains('source-img') || e.target.classList.contains('tab-logo'))) {
        const img = e.target;
        const parent = img.parentElement;
        const initials = img.dataset.initials || 'מ';
        const domain = img.dataset.domain;
        const isTab = img.classList.contains('tab-logo');

        if (img.dataset.failed) {
          // Second failure (favicon failed too): show initials
          parent.innerHTML = `<span class="${isTab ? 'tab-initials' : 'badge-initials'}">${initials}</span>`;
        } else {
          // First failure: try google favicon
          img.dataset.failed = 'true';
          if (domain) {
            img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
            // If the tab contains a label, we don't want to wipe the whole innerHTML, 
            // just the logo container but since img is inside a container it's fine.
          } else {
            parent.innerHTML = `<span class="${isTab ? 'tab-initials' : 'badge-initials'}">${initials}</span>`;
          }
        }
      }
    }, true);

    // Load preferences
    loadPreferences();

    // Start clock
    updateClock();
    setInterval(updateClock, 1000);

    // Event listeners
    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.presentationToggle.addEventListener('click', togglePresentationMode);
    dom.soundToggle.addEventListener('click', toggleSound);
    dom.pushToggle.addEventListener('click', togglePush);
    updatePushBtn();
    // Handle autoplay audio interaction
    document.addEventListener('mousedown', initAudio);
    document.addEventListener('keydown', initAudio);

    dom.refreshBtn.addEventListener('click', () => {
      window.location.reload();
    });

    // Source management panel
    dom.sourceSettingsBtn.addEventListener('click', openSourcePanel);
    dom.sourcePanelClose.addEventListener('click', closeSourcePanel);
    dom.sourcePanelOverlay.addEventListener('click', closeSourcePanel);
    dom.enableAllSources.addEventListener('click', () => setAllSources(true));
    dom.disableAllSources.addEventListener('click', () => setAllSources(false));

    // Handle exiting fullscreen with ESC
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && state.isPresentationMode) {
        togglePresentationMode();
      }
    });

    // Connect to SSE
    connectStream();

    // Fetch weather
    fetchWeather();
    setInterval(fetchWeather, 60 * 60 * 1000); // Every hour
  }

  // --- Run ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for retry button
  window.connectStream = connectStream;
})();
