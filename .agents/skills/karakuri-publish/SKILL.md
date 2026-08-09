---
name: karakuri-publish
description: Publish human-approved KARAKURI feed items end-to-end (data/inbox.json approvals → npm run feed:publish → commit & push → verify live on karakuri-gamma.vercel.app). Use when the user says "publish" / "公開して" / names feed items to go live, or an agent needs the review→publish→push→live-check cycle. Enforces the AGENTS.md human-gate rules: never self-approves.
---

# KARAKURI publish cycle

End-to-end publishing of feed items for the KARAKURI site (repo `katsu1110/karakuri`,
prod `https://karakuri-gamma.vercel.app`, Vercel Git integration deploys on push to `main`).

Pipeline: `data/inbox.json` (statuses `new` → `draft` → `approved` → `published`, or
`rejected`) → `npm run feed:publish` → `public/data/papers.json` … and the site. The
only step that must remain human is *deciding* what is approved — this skill's job is
the mechanical cycle after that decision, executed with guardrails.

## In scope

- Flip `status: "draft"` → `"approved"` **only** on items the user explicitly listed (by
  OpenAlex id / Japanese title / position).
- Run the publish step, verify the diff, commit & push, confirm the live site.

## Out of scope — never do without explicit user instruction

- Setting `approved` on items the user did not name, or "publish all" interpretations of
  ambiguous phrasing. "publish them all" / "OK全部出して" IS explicit — but machine-terse:
  when in doubt, list the ids you're about to approve and require a yes.
- Editing the generated Japanese copies (`title_ja`/`summary_ja`/`why_ja`) — the user
  edits those themselves and the diff shows their changes; preserve them byte-for-byte
  when flipping status only.
- Publishing an item whose `doi` is missing/null (the publish script skips it with a
  warning — reflect that in the report; do not fabricate a DOI).

## Steps

1. **Read** `data/inbox.json`. Identify targets by `id` (e.g. `W7201864296`) and current
   status. Reject targets that are already `published`, unknown, or not `draft` (unless
   the user named an `approved` item — then publish it).
2. With a JSON-safe edit (node or edit tool), set `"status": "approved"` on exactly the
   named items; leave every other field untouched. Do NOT touch `public/`.
3. Run `npm run feed:publish` (cwd = repo root).
   Acceptable outcomes:
   - `Wrote N new published item(s) to public/data/papers.json.` — expected.
   - `Warning: Skipping item <id> … required Japanese fields missing` / `no DOI` — do not
     fix silently; report the skipped ids to the user before pushing anything.
4. **Inspect the diff** (`git diff --stat` + `git diff public/data/papers.json`):
   - `abstract_en` must NOT appear anywhere in `public/` (invariant).
   - each new entry has `doi`, `title_ja`, `summary_ja`, `why_ja`, `published_at`.
   - `data/inbox.json` only shows status flips + `published_at` for the published ones.
5. Commit BOTH files (`data/inbox.json`, `public/data/papers.json`) with message
   `feed: publish <YYYY-MM-DD>`; push to `main` (`git pull --rebase` first if rejected).
6. **Live check** — wait for Vercel deploy (usually < 60s), then verify end-to-end:
   - `curl -s https://karakuri-gamma.vercel.app/data/papers.json` — every new id present;
   - `curl -s -o /dev/null -w "%{http_code}" https://karakuri-gamma.vercel.app/` → 200;
   - article pages if the batch included articles: `/article.html?slug=<slug>` → 200.
7. Report a compact table: id → title_ja → live status (verified at which URL), plus any
   skips and their reason.

## Failure modes

- `git push` rejected → `git pull --rebase` then re-push; re-run step 6 after.
- Workflow `Deploy Site` fails on GitHub Actions (check `gh run list`) → the push may have
  broken the build; do NOT claim "live". Inspect the failing step, fix at the source.
- Vercel still serving old `papers.json` after 3 min → report deployment status via
  `https://karakuri-gamma.vercel.app` probing + GitHub run logs; do not fake success.

## Reporting

End with a status line: `published N of M · skipped: [ids+reason] (if any) · live at
karakuri-gamma.vercel.app/data/papers.json` plus the per-item table. Everything unverified
must be marked as unverified — never claim a 200 without having observed it.