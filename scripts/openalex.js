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

  const delays = [1000, 4000, 16000];
  let lastError = null;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': `karakuri-fetcher (${mailto})`
        }
      });

      if (res.ok) {
        return await res.json();
      }

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`OpenAlex HTTP ${res.status}: ${res.statusText}`);
      } else {
        throw new Error(`OpenAlex HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      lastError = err;
      if (attempt === delays.length) {
        throw lastError;
      }
    }

    if (attempt < delays.length) {
      console.warn(`OpenAlex request failed (${lastError?.message}). Retrying in ${delays[attempt]}ms...`);
      await sleep(delays[attempt]);
    }
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
