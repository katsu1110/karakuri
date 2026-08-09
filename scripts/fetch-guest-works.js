import fs from 'node:fs';
import path from 'node:path';
import { openalexGet } from './openalex.js';

const GUESTS_PATH = path.resolve('content/guests.json');

function getThreeYearsAgoStr() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return d.toISOString().split('T')[0];
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/fetch-guest-works.js <guest-slug>');
    process.exit(1);
  }

  if (!fs.existsSync(GUESTS_PATH)) {
    console.error('Error: content/guests.json does not exist.');
    process.exit(1);
  }

  const guests = JSON.parse(fs.readFileSync(GUESTS_PATH, 'utf-8'));
  const guest = guests.find((g) => g.slug === slug);

  if (!guest) {
    console.error(`Error: Guest with slug "${slug}" not found in content/guests.json.`);
    process.exit(1);
  }

  const authorId = guest.openalex_author_id;
  if (!authorId) {
    console.error(`Error: Guest "${slug}" does not have an openalex_author_id configured.`);
    process.exit(1);
  }

  const threeYearsAgo = getThreeYearsAgoStr();
  console.log(`Fetching recent works for ${guest.name_en} (${guest.name_ja}, ID: ${authorId}) since ${threeYearsAgo}...`);

  try {
    const data = await openalexGet('/works', {
      filter: `author.id:${authorId},from_publication_date:${threeYearsAgo}`,
      sort: 'publication_date:desc',
      'per-page': '25'
    });

    const results = data.results || [];
    if (results.length === 0) {
      console.log(`No works found for author ${authorId} since ${threeYearsAgo}.`);
      return;
    }

    console.log(`\nFound ${results.length} work(s):\n`);
    for (let i = 0; i < results.length; i++) {
      const work = results[i];
      const title = work.title || 'Untitled';
      const venue =
        work.primary_location?.source?.display_name ||
        work.locations?.[0]?.source?.display_name ||
        'Unknown venue';
      const published = work.publication_date || '';
      const doi = work.doi || 'No DOI';
      const citedCount = work.cited_by_count ?? 0;

      console.log(`[${i + 1}] ${title}`);
      console.log(`    Date: ${published} | Venue: ${venue} | Cited: ${citedCount} time(s)`);
      console.log(`    DOI: ${doi}\n`);
    }
  } catch (err) {
    console.error(`Error fetching works for guest ${slug}:`, err.message);
    process.exit(1);
  }
}

main();
