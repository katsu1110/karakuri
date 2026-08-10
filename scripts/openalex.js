 // Using global fetch (Node 18+)

export const FEED_SOURCES = [
  'S2764866340', // Nature Human Behaviour
  'S58854535',   // Psychological Science
  'S29984966',   // J. Personality & Social Psychology
  'S88198767',   // Cognition
  'S75627607',   // Psychological Bulletin
  'S27228949',   // Perspectives on Psych. Science
  'S125754415',  // PNAS
  'S4220651275', // PNAS Nexus
  'S179575189',  // Judgment and Decision Making
  'S62013203',   // JEP: General
  'S187348256',  // Personality & Social Psych. Bulletin
  'S35223124'    // Psychological Review
].join('|');

export const FEED_SUBFIELDS = [
  'subfields/3207', // Social Psychology
  'subfields/3205', // Experimental & Cognitive Psychology
  'subfields/3202', // Applied Psychology
  'subfields/2805', // Cognitive Neuroscience
  'subfields/1803', // Management Science & OR
  'subfields/3300'  // General Social Sciences
].join('|');

const BASE_URL = 'https://api.openalex.org';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function openalexGet(endpoint, params = {}) {
  const mailto = process.env.OPENALEX_MAILTO || 'code1110g-show@hotmail.co.jp';
  const searchParams = new URLSearchParams(params);
  searchParams.set('mailto', mailto);

  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}?${searchParams.toString()}`;

  // A transient 429 must never silently kill a day's feed run. Retry budget:
  // 8 attempts total (~4 min worst case), exponential backoff capped at 120s,
  // honoring OpenAlex's Retry-After header on 429 when present.
  const MAX_ATTEMPTS = 8;
  const BASE_DELAY_MS = 2000;
  const MAX_DELAY_MS = 120_000;

  let lastError = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': `karakuri-fetcher (${mailto})`
        }
      });
    } catch (err) {
      // Network-level failure (timeout, DNS, connection reset) — retryable.
      lastError = err;
      if (attempt === MAX_ATTEMPTS - 1) {
        throw lastError;
      }
    }

    if (res) {
      if (res.ok) {
        return await res.json();
      }

      lastError = new Error(`OpenAlex HTTP ${res.status}: ${res.statusText}`);
      if (res.status === 429) {
        const retryAfterSec = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
        if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
          lastError.retryAfterMs = Math.min(retryAfterSec * 1000, MAX_DELAY_MS);
        }
      }
      if (res.status !== 429 && res.status < 500) {
        throw lastError; // non-retryable client error (e.g. 400, 404)
      }
      if (attempt === MAX_ATTEMPTS - 1) {
        throw lastError;
      }
    }

    const backoffMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
    const waitMs = Math.max(backoffMs, lastError?.retryAfterMs ?? 0);
    console.warn(
      `OpenAlex request failed (${lastError.message}). Retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 2}/${MAX_ATTEMPTS})...`
    );
    await sleep(waitMs);
  }

  throw lastError;
}

export function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') {
    return '';
  }

  let maxPos = -1;
  for (const positions of Object.values(invertedIndex)) {
    for (const pos of positions) {
      if (pos > maxPos) {
        maxPos = pos;
      }
    }
  }

  if (maxPos < 0) return '';

  const words = new Array(maxPos + 1);
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }

  return words.join(' ');
}
