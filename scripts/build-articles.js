import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const ARTICLES_DIR = path.resolve('content/articles');
const PUBLIC_ARTICLES_DIR = path.resolve('public/articles');
const PUBLIC_ARTICLES_JSON = path.resolve('public/data/articles.json');
const SITE_URL = 'https://karakuri-gamma.vercel.app';

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Frontmatter date may parse as a JS Date (YAML `2026-08-16` → UTC midnight).
// String(Date) yields "Sun Aug 16 2026 …" — always emit YYYY-MM-DD instead.
// UTC getters preserve the literal YAML date regardless of builder timezone.
function formatDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value ?? '');
}

function stripMarkdown(md) {
  return md
    .replace(/^#+\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`{1,3}.*?`{1,3}/gs, '')
    .replace(/>\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  if (!fs.existsSync(PUBLIC_ARTICLES_DIR)) {
    fs.mkdirSync(PUBLIC_ARTICLES_DIR, { recursive: true });
  }
  // Static article pages link /css/style.css (verbatim-copied to dist).
  // They bypass Vite's CSS bundling, so sync the single source of truth here.
  const publicCssDir = path.resolve('public/css');
  if (!fs.existsSync(publicCssDir)) {
    fs.mkdirSync(publicCssDir, { recursive: true });
  }
  fs.copyFileSync(path.resolve('src/style.css'), path.join(publicCssDir, 'style.css'));

  if (!fs.existsSync(ARTICLES_DIR)) {
    fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  }

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'));
  console.log(`Found ${files.length} article file(s) in content/articles/.`);

  // Purge previously generated article HTML: the source of truth is
  // content/articles/. Anything not (re)generated this run must not be
  // left behind as a stale, publicly reachable artifact (draft / renamed
  // / deleted articles must disappear from the built site).
  for (const oldFile of fs.readdirSync(PUBLIC_ARTICLES_DIR)) {
    if (oldFile.endsWith('.html')) {
      fs.unlinkSync(path.join(PUBLIC_ARTICLES_DIR, oldFile));
    }
  }

  const seenSlugs = new Set();
  const publishedArticles = [];

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(rawContent);

    if (frontmatter.status !== 'published') {
      console.log(`Skipping [${file}] because status is "${frontmatter.status || 'draft'}".`);
      continue;
    }

    const slug = frontmatter.slug;
    if (!slug) {
      console.error(`Error in [${file}]: Missing required frontmatter field "slug".`);
      process.exit(1);
    }

    if (seenSlugs.has(slug)) {
      console.error(`Error: Duplicate slug "${slug}" found in file [${file}].`);
      process.exit(1);
    }
    seenSlugs.add(slug);

    if (!Array.isArray(frontmatter.sources) || frontmatter.sources.length === 0) {
      console.error(`Error in [${file}]: Required frontmatter field "sources" must be a non-empty array.`);
      process.exit(1);
    }

    let htmlBody = marked.parse(content);

    // Append standard attribution if episode_ref is present
    if (frontmatter.episode_ref && frontmatter.episode_ref.title && frontmatter.episode_ref.url) {
      const epTitle = frontmatter.episode_ref.title;
      const epUrl = frontmatter.episode_ref.url;
      const attributionHtml = `\n<blockquote class="attribution-box">このテーマを知ったきっかけ: Hidden Brain「<a href="${escHtml(epUrl)}" target="_blank" rel="noopener noreferrer">${escHtml(epTitle)}</a>」（<a href="${escHtml(epUrl)}" target="_blank" rel="noopener noreferrer">${escHtml(epUrl)}</a>）。本記事は同番組の翻訳・要約ではなく、番組に出演した研究者の公開論文にもとづく筆者独自の解説です。</blockquote>`;
      htmlBody += attributionHtml;
    }

    // Sources section HTML appended at the bottom
    let sourcesHtml = '<section class="article-sources"><h3>参考文献・一次資料</h3><ul>';
    for (const src of frontmatter.sources) {
      sourcesHtml += `<li><a href="${escHtml(src.url)}" target="_blank" rel="noopener noreferrer">${escHtml(src.label)}</a></li>`;
    }
    sourcesHtml += '</ul></section>';
    htmlBody += sourcesHtml;

    const plainText = stripMarkdown(content);
    const lead = plainText.length > 120 ? plainText.slice(0, 120) + '…' : plainText;

    // Standalone static page: a full HTML document so crawlers index the
    // article text without executing JavaScript. Canonical URL is
    // /articles/<slug>.html (also the sitemap + index link target).
    const docTitle = `${frontmatter.title || slug} — KARAKURI`;
    const pageUrl = `${SITE_URL}/articles/${encodeURIComponent(slug)}.html`;
    const researcherLine = [
      frontmatter.researcher?.name_ja || '',
      frontmatter.researcher?.name_en ? `(${frontmatter.researcher.name_en})` : '',
      frontmatter.researcher?.affiliation ? `(${frontmatter.researcher.affiliation})` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const doc = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>${escHtml(docTitle)}</title>
  <meta name="description" content="${escHtml(lead)}" />
  <link rel="canonical" href="${escHtml(pageUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="KARAKURI（からくり）" />
  <meta property="og:title" content="${escHtml(String(frontmatter.title || slug))}" />
  <meta property="og:description" content="${escHtml(lead)}" />
  <meta property="og:url" content="${escHtml(pageUrl)}" />
  <meta property="og:image" content="${SITE_URL}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <header>
    <div class="header-container">
      <div class="brand">
        <h1><a href="/">KARAKURI</a></h1>
        <p>行動科学・社会心理学の査読論文を日本語で独自解説</p>
      </div>
      <nav>
        <a href="/">← トップへ戻る</a> |
        <a href="/policy.html">出典・引用方針・免責</a>
      </nav>
    </div>
  </header>

  <main>
    <article id="article-detail" class="article-detail">
      <h1>${escHtml(String(frontmatter.title || slug))}</h1>
      <div class="detail-meta">
        <span>公開日: ${escHtml(formatDate(frontmatter.date))}</span>${researcherLine ? ` |\n        <span>対象研究者: ${escHtml(researcherLine)}</span>` : ''}
      </div>
      <div class="article-content" id="article-body">
${htmlBody}
      </div>
    </article>
  </main>

  <footer>
    <p>&copy; KARAKURI | <a href="/policy.html">出典・引用方針・免責事項</a></p>
  </footer>
</body>
</html>
`;
    const outPath = path.join(PUBLIC_ARTICLES_DIR, `${slug}.html`);
    fs.writeFileSync(outPath, doc, 'utf-8');
    console.log(`Generated public/articles/${slug}.html`);

    publishedArticles.push({
      slug,
      title: frontmatter.title || '',
      date: formatDate(frontmatter.date),
      lead,
      researcher_name_ja: frontmatter.researcher?.name_ja || '',
      researcher_name_en: frontmatter.researcher?.name_en || '',
      researcher_affiliation: frontmatter.researcher?.affiliation || '',
      sources: frontmatter.sources,
      episode_ref: frontmatter.episode_ref || null,
      note_url: frontmatter.note_url || ''
    });
  }

  // Sort by date descending
  publishedArticles.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  fs.writeFileSync(PUBLIC_ARTICLES_JSON, JSON.stringify(publishedArticles, null, 2), 'utf-8');
  console.log(`Wrote ${publishedArticles.length} published article(s) to public/data/articles.json.`);
}

try {
  main();
} catch (err) {
  console.error('Fatal error in build-articles:', err);
  process.exit(1);
}
