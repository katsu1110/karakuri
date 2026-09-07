function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadArticleDetail() {
  const container = document.getElementById('article-content');
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    container.innerHTML = '<h2>記事が指定されていません。</h2><p><a href="/">トップページへ戻る</a></p>';
    return;
  }

  try {
    const metaRes = await fetch('/data/articles.json');
    let meta = null;
    if (metaRes.ok) {
      const articles = await metaRes.json();
      meta = articles.find((a) => a.slug === slug);
    }

    const contentRes = await fetch(`/articles/${encodeURIComponent(slug)}.html`);
    if (!contentRes.ok) {
      throw new Error(`Article body not found (HTTP ${contentRes.status})`);
    }

    const html = await contentRes.text();
    // Static pages are full HTML documents (crawler-indexable). Extract
    // just the article body for injection into the viewer shell.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const bodyEl = doc.querySelector('#article-body');
    const bodyHtml = bodyEl ? bodyEl.innerHTML : html;
    const staticUrl = `/articles/${encodeURIComponent(slug)}.html`;

    // Point crawlers at the canonical static page (dedupes the ?slug= viewer).
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = staticUrl;

    if (meta) {
      document.title = `${esc(meta.title)} — KARAKURI`;
      if (meta.lead) {
        let desc = document.querySelector('meta[name="description"]');
        if (!desc) {
          desc = document.createElement('meta');
          desc.name = 'description';
          document.head.appendChild(desc);
        }
        desc.content = meta.lead;
      }
      const metaHeader = `
        <h1>${esc(meta.title)}</h1>
        <div class="detail-meta">
          <span>公開日: ${esc(meta.date)}</span> |
          <span>対象研究者: ${esc(meta.researcher_name_ja)}${
            meta.researcher_name_en ? ` (${esc(meta.researcher_name_en)})` : ''
          }${meta.researcher_affiliation ? ` (${esc(meta.researcher_affiliation)})` : ''}</span>
        </div>
      `;
      container.innerHTML = metaHeader + `<div class="article-content">${bodyHtml}</div>`;
    } else {
      container.innerHTML = `<div class="article-content">${bodyHtml}</div>`;
    }
  } catch (err) {
    console.error('Failed to load article:', err);
    container.innerHTML = `<h2>記事の読み込みに失敗しました。</h2><p>${esc(err.message)}</p><p><a href="/">トップページへ戻る</a></p>`;
  }
}

document.addEventListener('DOMContentLoaded', loadArticleDetail);