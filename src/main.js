function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadArticles() {
  const container = document.getElementById('articles-container');
  try {
    const res = await fetch('/data/articles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const articles = await res.json();

    if (!Array.isArray(articles) || articles.length === 0) {
      container.innerHTML = '<p class="empty-msg">現在公開中の深掘り記事はありません。</p>';
      return;
    }

    container.innerHTML = articles
      .map(
        (art) => `
      <article class="article-card">
        <div class="meta">${esc(art.date)} | 研究者: ${esc(art.researcher_name_ja)} (${esc(art.researcher_affiliation || art.researcher_name_en)})</div>
        <h3><a href="/article.html?slug=${encodeURIComponent(art.slug)}">${esc(art.title)}</a></h3>
        <p class="lead">${esc(art.lead)}</p>
      </article>
    `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load articles:', err);
    container.innerHTML = '<p class="error-msg">記事の読み込みに失敗しました。</p>';
  }
}

function renderFeedCard(paper) {
  const authors = (paper.authors || []).map(esc).join(', ');
  return `
      <article class="feed-card">
        <div class="feed-meta">
          <span>掲載誌: ${esc(paper.venue)}</span>
          <span>出版日: ${esc(paper.published)}</span>
          <span>公開日: ${esc(paper.reviewed_at)}</span>
        </div>
        <h3>${esc(paper.title_ja)}</h3>
        <div class="title-en">原題: ${esc(paper.title_en)} (${authors})</div>
        <p class="summary-ja">${esc(paper.summary_ja)}</p>
        <div class="why-box"><strong>なぜ効くか:</strong> ${esc(paper.why_ja)}</div>
        <a href="${esc(paper.doi)}" target="_blank" rel="noopener noreferrer" class="doi-link">
          論文の一次情報を見る (DOI: ${esc(paper.doi)})
        </a>
      </article>
    `;
}

async function loadFeed() {
  const container = document.getElementById('feed-container');
  try {
    const res = await fetch('/data/papers.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const papers = await res.json();

    if (!Array.isArray(papers) || papers.length === 0) {
      container.innerHTML = '<p class="empty-msg">現在公開中の論文フィードはありません。</p>';
      return;
    }

    container.innerHTML = papers.map(renderFeedCard).join('');
  } catch (err) {
    console.error('Failed to load paper feed:', err);
    container.innerHTML = '<p class="error-msg">フィードの読み込みに失敗しました。</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadArticles();
  loadFeed();
});