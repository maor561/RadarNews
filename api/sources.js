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

export default (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    success: true,
    sources: FEED_SOURCES.map(s => ({
      id: s.id,
      name: s.name,
      nameHe: s.nameHe,
      color: s.color,
      domain: s.domain,
      logoUrl: s.logoUrl,
      url: s.url
    }))
  });
};
