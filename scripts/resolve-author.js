import { openalexGet } from './openalex.js';

async function main() {
  const authorName = process.argv[2];
  if (!authorName) {
    console.error('Usage: node scripts/resolve-author.js "<Author Name>"');
    process.exit(1);
  }

  console.log(`Searching OpenAlex authors for "${authorName}"...`);

  try {
    const data = await openalexGet('/authors', {
      search: authorName,
      'per-page': '5'
    });

    const results = data.results || [];
    if (results.length === 0) {
      console.log('候補なし');
      process.exit(1);
    }

    console.log(`Top ${results.length} author candidates found:\n`);
    for (const author of results) {
      const rawId = author.id || '';
      const id = rawId.replace('https://openalex.org/', '');
      const name = author.display_name || '';
      const worksCount = author.works_count ?? 0;
      const affiliation =
        author.last_known_institutions?.[0]?.display_name ||
        author.last_known_institution?.display_name ||
        'No affiliation';

      console.log(`${id.padEnd(14)} ${name.padEnd(25)} ${String(worksCount).padStart(5)} works  ${affiliation}`);
    }
  } catch (err) {
    console.error(`Error resolving author "${authorName}":`, err.message);
    process.exit(1);
  }
}

main();
