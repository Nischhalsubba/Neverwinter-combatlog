export const SITE = Object.freeze({
  origin: 'https://neverwinter-combatlog.hinischalsubba.workers.dev',
  name: 'Strikeglass',
  title: 'Strikeglass | Neverwinter Combat Log Analyzer',
  description: 'Analyze Neverwinter combat logs locally with double-checked DPS, boss fights, player comparison, power damage, and raw-hit details.',
  socialImagePath: '/assets/strikeglass-social.png',
  themeColor: '#f6f8fb',
  language: 'en',
  pages: [
    { path: '/', key: 'home', changefreq: 'weekly', priority: '1.0' },
    { path: '/how-to-use/', key: 'how-to-use', changefreq: 'monthly', priority: '0.8' },
    { path: '/dps-explained/', key: 'dps-explained', changefreq: 'monthly', priority: '0.8' },
    { path: '/privacy/', key: 'privacy', changefreq: 'yearly', priority: '0.5' },
    { path: '/about/', key: 'about', changefreq: 'monthly', priority: '0.6' }
  ]
});

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE.origin}/`).href;
}
