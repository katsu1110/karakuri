import fs from 'node:fs';
import path from 'node:path';

const INBOX_PATH = path.resolve('data/inbox.json');

/**
 * Auto-approval gate for the daily feed (Policy B):
 * - items with confidence "high" AND all required Japanese fields AND a DOI
 *   are promoted to "approved" so publish-papers.js can take them public.
 * - anything below high confidence, missing fields, or missing DOI stays
 *   "draft" for human review. No exceptions.
 */
function main() {
  if (!fs.existsSync(INBOX_PATH)) {
    console.log('data/inbox.json does not exist. Nothing to do.');
    return;
  }

  const inbox = JSON.parse(fs.readFileSync(INBOX_PATH, 'utf-8'));
  let approved = 0;
  let held = 0;

  for (const item of inbox) {
    if (item.status !== 'draft') continue;

    const missingFields = ['title_ja', 'summary_ja', 'why_ja'].filter(
      (k) => !item[k] || typeof item[k] !== 'string' || item[k].trim() === ''
    );

    if (item.confidence !== 'high') {
      console.log(`Holding ${item.id} for review (confidence: ${item.confidence}).`);
      held++;
      continue;
    }
    if (missingFields.length > 0) {
      console.log(`Holding ${item.id} for review (missing fields: ${missingFields.join(', ')}).`);
      held++;
      continue;
    }
    if (!item.doi) {
      console.log(`Holding ${item.id} for review (no DOI).`);
      held++;
      continue;
    }

    item.status = 'approved';
    approved++;
  }

  fs.writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2), 'utf-8');
  console.log(`Auto-approval complete. Approved: ${approved}, held for review: ${held}.`);
}

try {
  main();
} catch (err) {
  console.error('Fatal error in auto-approve:', err);
  process.exit(1);
}