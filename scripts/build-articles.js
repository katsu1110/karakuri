import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const ARTICLES_DIR = path.resolve('content/articles');
const PUBLIC_ARTICLES_DIR = path.resolve('public/articles');
const PUBLIC_ARTICLES_JSON = path.resolve('public/data/articles.json');

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
      const attributionHtml = `\n<blockquote class="attribution-box">このテーマを知ったきっかけ: Hidden Brain「<a href="${epUrl}" target="_blank" rel="noopener noreferrer">${epTitle}</a>」（<a href="${epUrl}" target="_blank" rel="noopener noreferrer">${epUrl}</a>）。本記事は同番組の翻訳・要約ではなく、番組に出演した研究者の公開論文にもとづく筆者独自の解説です。</blockquote>`;
      htmlBody += attributionHtml;
    }

    // Sources section HTML appended at the bottom
    let sourcesHtml = '<section class="article-sources"><h3>参考文献・一次資料</h3><ul>';
    for (const src of frontmatter.sources) {
      sourcesHtml += `<li><a href="${src.url}" target="_blank" rel="noopener noreferrer">${src.label}</a></li>`;
    }
    sourcesHtml += '</ul></section>';
    htmlBody += sourcesHtml;

    const outPath = path.join(PUBLIC_ARTICLES_DIR, `${slug}.html`);
    fs.writeFileSync(outPath, htmlBody, 'utf-8');
    console.log(`Generated public/articles/${slug}.html`);

    const plainText = stripMarkdown(content);
    const lead = plainText.length > 120 ? plainText.slice(0, 120) + '…' : plainText;

    publishedArticles.push({
      slug,
      title: frontmatter.title || '',
      date: frontmatter.date ? String(frontmatter.date) : '',
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
