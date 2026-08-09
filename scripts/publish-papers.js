import fs from 'node:fs';
import path from 'node:path';

const INBOX_PATH = path.resolve('data/inbox.json');
const PUBLIC_PAPERS_PATH = path.resolve('public/data/papers.json');

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function main() {
  if (!fs.existsSync(INBOX_PATH)) {
    console.log('inbox.json does not exist.');
    return;
  }

  const inbox = JSON.parse(fs.readFileSync(INBOX_PATH, 'utf-8'));
  let publicPapers = [];
  if (fs.existsSync(PUBLIC_PAPERS_PATH)) {
    publicPapers = JSON.parse(fs.readFileSync(PUBLIC_PAPERS_PATH, 'utf-8'));
  }

  const approvedItems = inbox.filter((item) => item.status === 'approved');

  if (approvedItems.length === 0) {
    console.log('No "approved" items found in inbox.json to publish.');
    return;
  }

  console.log(`Found ${approvedItems.length} "approved" item(s) to publish.`);
  const todayStr = getTodayStr();

  const existingPublicIds = new Set(publicPapers.map((p) => p.id));
  const newPublicEntries = [];

  for (const item of approvedItems) {
    if (!item.title_ja || !item.summary_ja || !item.why_ja) {
      console.warn(`Warning: Skipping item ${item.id} because required Japanese fields are missing.`);
      continue;
    }

    if (!item.doi) {
      // Feed items must always link to the primary source (DOI). An item
      // without a DOI must stay unpublished rather than render a broken link.
      console.warn(`Warning: Skipping item ${item.id} because it has no DOI.`);
      continue;
    }

    item.status = 'published';
    item.published_at = item.published_at || todayStr;

    const publicEntry = {
      id: item.id,
      doi: item.doi,
      title_en: item.title_en,
      title_ja: item.title_ja,
      authors: item.authors,
      venue: item.venue,
      published: item.published,
      summary_ja: item.summary_ja,
      why_ja: item.why_ja,
      guest_slug: item.guest_slug || null,
      reviewed_at: todayStr
    };

    // Ensure abstract_en is NOT included in public data
    delete publicEntry.abstract_en;

    if (!existingPublicIds.has(item.id)) {
      newPublicEntries.push(publicEntry);
      existingPublicIds.add(item.id);
    }
  }

  if (newPublicEntries.length > 0) {
    // Prepend new published entries
    publicPapers = [...newPublicEntries, ...publicPapers];
    fs.writeFileSync(PUBLIC_PAPERS_PATH, JSON.stringify(publicPapers, null, 2), 'utf-8');
    console.log(`Wrote ${newPublicEntries.length} new published item(s) to public/data/papers.json.`);
  }

  fs.writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2), 'utf-8');
  console.log('Updated data/inbox.json status to "published".');
}

try {
  main();
} catch (err) {
  console.error('Fatal error in publish-papers:', err);
  process.exit(1);
}
