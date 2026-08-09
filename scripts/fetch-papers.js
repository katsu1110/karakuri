import fs from 'node:fs';
import path from 'node:path';
import { openalexGet, reconstructAbstract, FEED_SOURCES, FEED_SUBFIELDS } from './openalex.js';

const INBOX_PATH = path.resolve('data/inbox.json');

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getFourteenDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().split('T')[0];
}

async function main() {
  let inbox = [];
  if (fs.existsSync(INBOX_PATH)) {
    const raw = fs.readFileSync(INBOX_PATH, 'utf-8');
    inbox = JSON.parse(raw);
  }

  // Find max published date in inbox
  let fromDate = null;
  for (const item of inbox) {
    if (item.published && (!fromDate || item.published > fromDate)) {
      fromDate = item.published;
    }
  }

  if (!fromDate) {
    fromDate = getFourteenDaysAgoStr();
  }

  console.log(`Fetching papers from OpenAlex with publication_date >= ${fromDate}...`);

  const filterStr = [
    `primary_location.source.id:${FEED_SOURCES}`,
    `primary_topic.subfield.id:${FEED_SUBFIELDS}`,
    `from_publication_date:${fromDate}`,
    'has_abstract:true',
    'type:article'
  ].join(',');

  const response = await openalexGet('/works', {
    filter: filterStr,
    sort: 'publication_date:desc',
    'per-page': '25'
  });

  const results = response.results || [];
  console.log(`OpenAlex returned ${results.length} candidate papers.`);

  const existingIds = new Set(inbox.map((item) => item.id));
  const newItems = [];
  const todayStr = getTodayStr();

  for (const work of results) {
    const rawId = work.id || '';
    const id = rawId.replace('https://openalex.org/', '');
    if (!id || existingIds.has(id)) {
      continue;
    }

    const abstractText = reconstructAbstract(work.abstract_inverted_index);
    if (!abstractText || abstractText.trim().length < 50) {
      continue;
    }

    const authors = (work.authorships || [])
      .map((a) => a.author?.display_name)
      .filter(Boolean);

    const venue =
      work.primary_location?.source?.display_name ||
      work.locations?.[0]?.source?.display_name ||
      '';

    const newItem = {
      id,
      doi: work.doi || null,
      title_en: work.title || '',
      authors,
      venue,
      published: work.publication_date || '',
      topic: work.primary_topic?.display_name || '',
      oa_status: work.open_access?.oa_status || 'closed',
      abstract_en: abstractText,
      title_ja: null,
      summary_ja: null,
      why_ja: null,
      guest_slug: null,
      status: 'new',
      fetched_at: todayStr
    };

    newItems.push(newItem);
    existingIds.add(id);

    if (newItems.length >= 5) {
      break;
    }
  }

  if (newItems.length === 0) {
    console.log('No new papers to add to inbox.');
    return;
  }

  inbox.push(...newItems);
  fs.writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2), 'utf-8');
  console.log(`Added ${newItems.length} new paper(s) to inbox.json.`);
}

main().catch((err) => {
  console.error('Error fetching papers:', err);
  process.exit(1);
});
