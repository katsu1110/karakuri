// Generates public/feed.xml (RSS 2.0) from public/data/papers.json.
// Runs at build time (npm run build) so every deploy ships a feed that
// matches the published papers exactly. The file is NOT committed to git
// (gitignored): the build regenerates it, and the cron pipeline never
// touches it (invariant 4 — cron writes only data/inbox.json and
// public/data/papers.json).
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://karakuri-gamma.vercel.app/';

const papersPath = path.resolve('public/data/papers.json');
const feedPath = path.resolve('public/feed.xml');

if (!fs.existsSync(papersPath)) {
  console.error(`FAIL: ${papersPath} missing — cannot generate feed.`);
  process.exit(1);
}

let papers;
try {
  papers = JSON.parse(fs.readFileSync(papersPath, 'utf-8'));
} catch (err) {
  console.error(`FAIL: ${papersPath} is not valid JSON: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(papers)) {
  console.error('FAIL: papers.json must be an array.');
  process.exit(1);
}

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Newest first; stable tiebreak by id.
const sorted = [...papers].sort(
  (a, b) =>
    String(b.published ?? '').localeCompare(String(a.published ?? '')) ||
    String(a.id).localeCompare(String(b.id)),
);

const items = sorted
  .filter((p) => p.title_ja && p.doi)
  .map((p) => {
    const description = [p.summary_ja, p.why_ja].filter(Boolean).join('\n\n');
    const creator = Array.isArray(p.authors) ? p.authors.join(', ') : '';
    const pubDate = p.published
      ? new Date(`${p.published}T00:00:00Z`).toUTCString()
      : null;
    return [
      '    <item>',
      `      <title>${escapeXml(p.title_ja)}</title>`,
      `      <link>${escapeXml(p.doi)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(p.doi)}</guid>`,
      description ? `      <description>${escapeXml(description)}</description>` : '',
      creator ? `      <dc:creator>${escapeXml(creator)}</dc:creator>` : '',
      pubDate ? `      <pubDate>${pubDate}</pubDate>` : '',
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n');
  })
  .join('\n');

const feed = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">',
  '  <channel>',
  '    <title>KARAKURI（からくり）— 新着論文</title>',
  `    <link>${SITE_URL}</link>`,
  '    <description>行動科学・社会心理学の査読論文を、やさしい日本語で毎日解説。新着論文フィード。</description>',
  '    <language>ja</language>',
  `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
  items,
  '  </channel>',
  '</rss>',
  '',
].join('\n');

// Light well-formedness guard: the doc must be a complete RSS document.
if (!feed.startsWith('<?xml') || !feed.trimEnd().endsWith('</rss>')) {
  console.error('FAIL: generated feed is not a well-formed RSS document.');
  process.exit(1);
}

fs.writeFileSync(feedPath, feed);
console.log(`Generated ${feedPath} with ${sorted.length} item(s).`);
