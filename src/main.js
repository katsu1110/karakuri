/* KARAKURI — トップページ描画: 深掘り記事 + 新着フィード（検索・タグ絞り込み・ページ送り） */

const PER_PAGE = 6;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const state = { papers: [], query: '', tag: '', page: 1 };

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ── 深掘り記事 ─────────────────────────────────── */
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
        <div class="meta">${esc(art.date)} · 研究者: ${esc(art.researcher_name_ja)}${
          art.researcher_affiliation ? ` — ${esc(art.researcher_affiliation)}` : ''
        }</div>
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

/* ── フィード ────────────────────────────────────── */
function renderFeedCard(paper) {
  const authors = (paper.authors || []).map(esc).join(', ');
  const topic = paper.topic || '未分類';
  const meta = `
        <span class="pill">${esc(topic)}</span>
        <span class="chip">${esc(paper.venue || '—')}</span>
        ${paper.published ? `<span class="chip">掲載 ${esc(paper.published)}</span>` : ''}
        ${paper.reviewed_at ? `<span class="chip">公開 ${esc(paper.reviewed_at)}</span>` : ''}
      `;
  return `
      <article class="feed-card">
        <div class="feed-meta">${meta}</div>
        <h3>${esc(paper.title_ja)}</h3>
        ${paper.title_en ? `<div class="title-en">原題: ${esc(paper.title_en)} (${authors})</div>` : ''}
        <p class="summary-ja">${esc(paper.summary_ja)}</p>
        ${paper.why_ja ? `<div class="why-box"><strong>なぜ効くか:</strong> ${esc(paper.why_ja)}</div>` : ''}
        <a class="doi-link" href="${esc(paper.doi)}" target="_blank" rel="noopener noreferrer">
          論文の一次情報を見る（DOI）
        </a>
      </article>
    `;
}

function filteredPapers() {
  const q = state.query.trim().toLowerCase();
  return state.papers.filter((p) => {
    if (state.tag && (p.topic || '') !== state.tag) return false;
    if (!q) return true;
    const haystack = [
      p.title_ja,
      p.title_en,
      p.venue,
      p.summary_ja,
      p.why_ja,
      (p.authors || []).join(' ')
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function pageSequence(pages, current) {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }
  const seq = [1];
  if (current > 3) seq.push(0); // gap
  for (let i = Math.max(2, current - 1); i <= Math.min(pages - 1, current + 1); i++) {
    seq.push(i);
  }
  if (current < pages - 3) seq.push(0); // gap
  seq.push(pages);
  return seq;
}

function renderPager(total, pages, current) {
  if (pages <= 1) return '';
  let html = `<button class="pager-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''} aria-label="前のページ">‹</button>`;
  html += pageSequence(pages, current)
    .map((n) =>
      n === 0
        ? '<span class="pager-ellipsis">…</span>'
        : `<button class="page-num${n === current ? ' active' : ''}" data-page="${n}" ${n === current ? 'aria-current="page"' : ''}>${n}</button>`
    )
    .join('');
  html += `<button class="pager-btn" data-page="${current + 1}" ${current === pages ? 'disabled' : ''} aria-label="次のページ">›</button>`;
  return html;
}

function renderFeed() {
  const container = document.getElementById('feed-container');
  const pager = document.getElementById('feed-pager');
  const countEl = document.getElementById('feed-count');

  if (state.papers.length === 0) {
    container.innerHTML = '<p class="empty-msg">現在公開中の論文フィードはありません。</p>';
    pager.innerHTML = '';
    countEl.textContent = '';
    return;
  }

  const filtered = filteredPapers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * PER_PAGE;
  const pageItems = filtered.slice(start, start + PER_PAGE);

  countEl.textContent = filtered.length
    ? `${start + 1}–${start + pageItems.length} / ${filtered.length}件`
    : '0件';

  if (pageItems.length === 0) {
    container.innerHTML = `
      <p class="empty-msg">条件に一致する論文が見つかりません。
        <button type="button" class="pager-btn" data-reset>条件をリセット</button>
      </p>`;
  } else {
    container.innerHTML = pageItems.map(renderFeedCard).join('');
  }
  pager.innerHTML = renderPager(filtered.length, totalPages, state.page);
}

function populateTagSelect() {
  const el = document.getElementById('feed-tag');
  const topics = [...new Set(state.papers.map((p) => p.topic || '未分類'))].sort((a, b) =>
    a.localeCompare(b)
  );
  el.innerHTML =
    '<option value="">テーマすべて</option>' +
    topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
}

async function loadFeed() {
  const container = document.getElementById('feed-container');
  try {
    const res = await fetch('/data/papers.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.papers = await res.json();
    populateTagSelect();
    renderFeed();
  } catch (err) {
    console.error('Failed to load paper feed:', err);
    container.innerHTML = '<p class="error-msg">フィードの読み込みに失敗しました。</p>';
  }
}

function resetFilters() {
  state.query = '';
  state.tag = '';
  state.page = 1;
  document.getElementById('feed-search').value = '';
  document.getElementById('feed-tag').value = '';
  renderFeed();
}

document.addEventListener('DOMContentLoaded', () => {
  loadArticles();
  loadFeed();

  const searchEl = document.getElementById('feed-search');
  const tagEl = document.getElementById('feed-tag');
  const pagerEl = document.getElementById('feed-pager');
  const containerEl = document.getElementById('feed-container');

  searchEl.addEventListener(
    'input',
    debounce(() => {
      state.query = searchEl.value;
      state.page = 1;
      renderFeed();
    }, 150)
  );

  tagEl.addEventListener('change', () => {
    state.tag = tagEl.value;
    state.page = 1;
    renderFeed();
  });

  containerEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) resetFilters();
  });

  pagerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-page]');
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    renderFeed();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('feed-container').focus({ preventScroll: true });
  });
});