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

    if (meta) {
      document.title = `${esc(meta.title)} — KARAKURI`;
      const metaHeader = `
        <h1>${esc(meta.title)}</h1>
        <div class="detail-meta">
          <span>公開日: ${esc(meta.date)}</span> |
          <span>対象研究者: ${esc(meta.researcher_name_ja)}${
            meta.researcher_name_en ? ` (${esc(meta.researcher_name_en)})` : ''
          }${meta.researcher_affiliation ? ` (${esc(meta.researcher_affiliation)})` : ''}</span>
        </div>
      `;
      container.innerHTML = metaHeader + `<div class="article-content">${html}</div>`;
    } else {
      container.innerHTML = `<div class="article-content">${html}</div>`;
    }
  } catch (err) {
    console.error('Failed to load article:', err);
    container.innerHTML = `<h2>記事の読み込みに失敗しました。</h2><p>${esc(err.message)}</p><p><a href="/">トップページへ戻る</a></p>`;
  }
}

document.addEventListener('DOMContentLoaded', loadArticleDetail);