---
name: karakuri-deepdive
description: Create a KARAKURI deep-dive article (content/articles/*.md) from a Hidden Brain episode — extract the featured researcher, resolve and verify their paper + DOI on OpenAlex, register the guest, write the やさしい日本語解説, and gate publication (Policy A: never self-publish an article). Use when the user says "write a deep dive based on this episode", "add a deep dive entry", "episode をもとに記事を書いて", or hands you a hiddenbrain.org episode URL with a request for a 深掘り記事.
---

# KARAKURI deep-dive article from a Hidden Brain episode

Deep-dive articles ("深掘り研究解説") live in `content/articles/*.md`; the only publish
path is a human setting `status: published` in the frontmatter (Policy A). No cron,
script, or agent ever auto-publishes an article. This skill produces the markdown +
verification for one episode's article, and only publishes when the user explicitly
confirms.

Each article is **original Japanese commentary on the researcher's published paper**,
not a translation or summary of the episode's narration (invariant 5). The episode is
credited via the standard attribution box, auto-appended by `build-articles.js` when
`episode_ref` is present.

## Steps

1. **Confirm scope.** Take the episode URL from the user (or resolve the title to
   `https://www.hiddenbrain.org/podcast/<slug>/`). If the page features multiple
   researchers, confirm with the user which one the article targets — the main guest
   whose research the episode is about, not the "Your Questions Answered" segment
   guest (usually out of scope).

2. **Read the episode page.** `read` the URL. Extract:
   - episode title + canonical URL → becomes `episode_ref`
   - featured researcher name(s) + faculty-page links
   - the research topic keywords (to match the right paper later)
   - ⚠️ The page embeds podcast audio URLs (`mgln.ai`, `simplecastaudio.com`,
     `feeds.simplecast.com`, `rss`). NEVER copy any of them into the article or any
     `public/` file — invariant 5, and verify-all check 4 fails the build on them.

3. **Resolve the researcher on OpenAlex.** Run
   `npm run guest:resolve "<full name>"` (requires `OPENALEX_MAILTO` env). Pick the
   candidate whose affiliation matches the faculty page and whose works count is sane.
   The `openalex_author_id` must be a real measured ID (e.g. `A5102957982`) — never
   invent one (invariant 6).

4. **Find the featured paper.** The paper is NOT linked on the episode page; find it via
   OpenAlex works for the author ID. If the guest is already in `content/guests.json`,
   `npm run guest:works <slug>` lists recent works with DOIs. Otherwise query OpenAlex
   directly (filter `author.id:<id>`, sort `publication_date:desc`) or check the
   researcher's faculty page / publications list. Choose the work the episode actually
   discusses (match topic keywords). Requirements:
   - peer-reviewed journal, abstract available
   - real DOI, URL form `https://doi.org/…` (invariant 6)
   - the featured researcher is an author
   If the guest is not yet registered, add an entry to `content/guests.json`
   (slug / name_en / name_ja / openalex_author_id / affiliation / episode{title,url} /
   `added: YYYY-MM-DD`) — matches the existing registry convention.

5. **Write the article.** Create `content/articles/<slug>.md`:
   - `slug`: kebab-case `<topic>-<researcher-lastname>` (e.g. `hero-journey-ben-rogers`).
     Must be unique — duplicate slugs fail the build.
   - Frontmatter (mirror `hero-journey-ben-rogers.md`):
     - `slug`, `title` (Japanese), `date` (YYYY-MM-DD — the day it goes live; today for
       drafts), `researcher: {name_ja, name_en, affiliation}`,
     - `sources: [{label, url}]` — non-empty array, real DOI URLs
     - `episode_ref: {title, url}` — REQUIRED for episode-based articles
     - `status: draft` (see step 7), `note_url: ""` (optional)
   - Body rules:
     - やさしい日本語; original commentary on the PAPER only
     - structure: a no-heading lead paragraph (its first ~120 chars become the index
       card summary after markdown-stripping), then `##` sections: the research
       question → key concepts/mechanism → experiments/evidence → practical
       application → 研究の限界と留意点 (limitations) — every article ends with limits
     - plain markdown only; no raw HTML, no scripts
     - brand rule: avoid wording that evokes 精神医療・カウンセリング
     - keep the title concise (the existing one is ~35 chars)

6. **Verify locally before any commit.** Run `npm run build` (generates
   `public/articles/<slug>.html` + `public/data/articles.json`; drafts are skipped and
   stay private) then `node scripts/verify-all.js` — all 5 checks must pass:
   1. inbox.json exists
   2. papers.json exists, no `abstract_en` leaks
   3. articles.json + article HTML exist, attribution box present when `episode_ref`
      is set ("このテーマを知ったきっかけ: Hidden Brain")
   4. zero Simplecast/RSS audio URLs in `public/`
   5. no stale HTML in `public/articles/`
   A draft article passes verify (it is simply absent from the public output).

7. **Publish — only on explicit user request.** Default `status: draft` and leave the
   file uncommitted for human review. When the user confirms publication:
   - flip `status: published`, re-run `npm run build && node scripts/verify-all.js`
   - commit `content/articles/<slug>.md`, `content/guests.json` (if changed),
     `public/articles/<slug>.html`, `public/data/articles.json`
   - push to `main` (Vercel Git integration deploys; `git pull --rebase` if rejected)
   - live check: wait for deploy, then verify
     `https://karakuri-gamma.vercel.app/article.html?slug=<slug>` returns 200 and the
     title + attribution box render; confirm the card appears in
     `https://karakuri-gamma.vercel.app/` deep-dive section via `/data/articles.json`.
   Never self-approve: if the user's request is ambiguous about publishing, keep the
   draft and list what's needed for a yes.

## Failure modes

- `guest:resolve` returns no candidate → check the episode page / faculty page for the
  exact name; try variations. Do not guess an ID.
- No single paper matches the episode topic → report the candidate works with DOIs to
  the user and let them pick; do not write the article around an unverified paper.
- Build/verify fails after writing → fix the article at the source (slug, sources,
  episode_ref, leaked URLs), never disable a check.
- Push rejected → `git pull --rebase` then re-push; re-run the live check after.

## Reporting

End with a status line: `article <slug> — draft/published · guest registered: yes/no ·
verify 5/5 · live at karakuri-gamma.vercel.app/article.html?slug=<slug> (only when
published)`. Mark anything unverified as unverified — never claim a 200 without having
observed it.
