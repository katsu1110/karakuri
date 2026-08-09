import fs from 'node:fs';
import path from 'node:path';

console.log('=== KOKORO-LAB VERIFICATION SUITE ===\n');

// 1. Check inbox.json
const inboxPath = path.resolve('data/inbox.json');
if (!fs.existsSync(inboxPath)) {
  console.error('FAIL: data/inbox.json missing!');
  process.exit(1);
}
const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
console.log(`[1] inbox.json exists with ${inbox.length} entries.`);

// 2. Check public/data/papers.json
const papersPath = path.resolve('public/data/papers.json');
if (!fs.existsSync(papersPath)) {
  console.error('FAIL: public/data/papers.json missing!');
  process.exit(1);
}
const papers = JSON.parse(fs.readFileSync(papersPath, 'utf-8'));
console.log(`[2] public/data/papers.json exists with ${papers.length} published entries.`);
for (const paper of papers) {
  if (paper.abstract_en !== undefined) {
    console.error(`FAIL: Paper ${paper.id} contains abstract_en in public output!`);
    process.exit(1);
  }
}
console.log('    ✓ Verified: zero abstract_en leaks in public/data/papers.json.');

// 3. Check public/data/articles.json & HTML
const articlesPath = path.resolve('public/data/articles.json');
const publicArticlesDir = path.resolve('public/articles');
if (!fs.existsSync(articlesPath)) {
  console.error('FAIL: public/data/articles.json missing!');
  process.exit(1);
}
const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
console.log(`[3] public/data/articles.json exists with ${articles.length} article(s).`);

for (const art of articles) {
  const htmlPath = path.resolve(`public/articles/${art.slug}.html`);
  if (!fs.existsSync(htmlPath)) {
    console.error(`FAIL: Article HTML missing at ${htmlPath}!`);
    process.exit(1);
  }
  const html = fs.readFileSync(htmlPath, 'utf-8');
  if (art.episode_ref && !html.includes('このテーマを知ったきっかけ: Hidden Brain')) {
    console.error(`FAIL: Article ${art.slug} missing standard attribution text!`);
    process.exit(1);
  }
  console.log(`    ✓ Verified HTML output for article "${art.slug}" with attribution box.`);
}

// 4. Forbidden domain check
const checkDirs = ['public/data', 'public/articles'];
let forbiddenCount = 0;
for (const dir of checkDirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isFile()) {
        const text = fs.readFileSync(fullPath, 'utf-8');
        if (text.includes('simplecast') || text.includes('feeds.simplecast.com') || text.includes('simplecastaudio.com')) {
          console.error(`FAIL: Forbidden URL found in ${fullPath}`);
          forbiddenCount++;
        }
      }
    }
  }
}

if (forbiddenCount > 0) {
  console.error(`FAIL: Found ${forbiddenCount} forbidden URL violations.`);
  process.exit(1);
} else {
  console.log('[4] ✓ Verified: zero RSS or Simplecast audio URLs in public build output.');
}

// 5. Stale artifact check: public/articles/*.html must exactly match the
//    published slugs listed in public/data/articles.json.
const publishedSlugs = new Set(articles.map((a) => a.slug));
if (fs.existsSync(publicArticlesDir)) {
  for (const file of fs.readdirSync(publicArticlesDir)) {
    if (file.endsWith('.html') && !publishedSlugs.has(file.replace(/\.html$/, ''))) {
      console.error(`FAIL: Stale article artifact found: public/articles/${file}`);
      process.exit(1);
    }
  }
  console.log('[5] ✓ Verified: no stale article HTML artifacts in public/articles.');
} else {
  console.error('FAIL: public/articles dir missing.');
  process.exit(1);
}

console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
