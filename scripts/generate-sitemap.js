// Generates public/sitemap.xml at build time from the fixed pages and the
// published article slugs in public/data/articles.json. Gitignored — the
// build regenerates it, and the cron pipeline never touches it
// (invariant 4 — cron writes only data/inbox.json and public/data/papers.json).
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://karakuri-gamma.vercel.app';
const ARTICLES_PATH = path.resolve('public/data/articles.json');
const SITEMAP_PATH = path.resolve('public/sitemap.xml');

if (!fs.existsSync(ARTICLES_PATH)) {
  console.error(`FAIL: ${ARTICLES_PATH} missing — cannot generate sitemap.`);
  process.exit(1);
}

let articles;
try {
  articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'));
} catch (err) {
  console.error(`FAIL: ${ARTICLES_PATH} is not valid JSON: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(articles)) {
  console.error('FAIL: articles.json must be an array.');
  process.exit(1);
}

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const urls = [
  { loc: `${SITE_URL}/`, priority: '1.0' },
  { loc: `${SITE_URL}/policy.html`, priority: '0.3' },
  ...articles.map((a) => ({
    loc: `${SITE_URL}/article.html?slug=${encodeURIComponent(a.slug)}`,
    lastmod: a.date || undefined,
    priority: '0.8',
  })),
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(
    (u) =>
      [
        '  <url>',
        `    <loc>${escapeXml(u.loc)}</loc>`,
        u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>` : '',
        `    <priority>${u.priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
  ),
  '</urlset>',
  '',
].join('\n');

if (!xml.startsWith('<?xml') || !xml.trimEnd().endsWith('</urlset>')) {
  console.error('FAIL: generated sitemap is not a well-formed XML document.');
  process.exit(1);
}

fs.writeFileSync(SITEMAP_PATH, xml);
console.log(`Generated ${SITEMAP_PATH} with ${urls.length} URL(s).`);
