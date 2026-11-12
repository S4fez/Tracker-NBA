# NBA Bet Tracker: rules for Claude

Read this file before every change to this repository. These rules are permanent and override defaults.
Priority when rules pull against each other: **data integrity → security → correctness → existing functionality → UI**.

## Project facts

- Static app, vanilla JS + CSS. No framework, no build step, no new dependencies unless truly necessary.
- Hosted on GitHub Pages from `main`: https://s4fez.github.io/Tracker-NBA/
- Layout (since 2026-11-12, design "Courtside Ledger" = base A + D scores ticker/game cards, B LOG scale/advanced filters/1–5 keys, C command palette/slide-over):
  - `index.html`: page shell only (markup for sidebar, topbar, ticker, settings dialog, filter sheet, command palette). No betting data.
  - `app/loader.js`: themes (1–8 classic presets + 9 Courtside Ledger, default 9), ⚙ Settings, read-only REST load, normalisers (`normTickets`, `normBets`: legacy totals, nicknames, text statuses), aggregates, `window.__filteredAgg`, then loads `app/app-1.js` → `app-2.js` → `app-3.js` in order.
  - `app/core.js`: `window.__startCore` → `window.Core` (tickets, bets, KPIs, games, impact feed, `analyticsFrom`).
  - `app/app-1.js` (helpers, nav, charts, dashboard, tickets), `app/app-2.js` (player-impact renderer, ticket detail, games, impact, analytics), `app/app-3.js` (ticker, slide-over, router, command palette, keys). They are classic scripts that share one global scope — load order matters.
  - `app/1.css`, `app/2.css`: styles.
  - `classic.html`: the previous single-file app, kept unchanged and linked from ⚙ Settings and the no-config/error screens. Same localStorage config.
- Data: Supabase project `bogxjsanowvweirywrmw`, read through the REST API with a **publishable key only** (entered by the user in ⚙ Settings, kept in that browser's localStorage key `nbaTrackerConfig`). The app is read-only: it never inserts, updates or deletes. No file in the repo may embed betting data.
- Tables:
  - `public.tickets`: `id`, `ticket_code`, `bet_date`, `stake`, `payout_if_win`, `status` (`pending|won|lost|void|partial`), `net_profit`, `created_at`, `user_id`.
    The frontend selects named columns so `user_id` is never downloaded.
  - `public.bets`: `id`, `ticket_id` → `tickets.id`, `selected_team`, `opponent`, `spread`, `odds`, `selected_score`, `opponent_score`,
    `result` (`pending|won|lost|push|void`), `reference_code`, `game_date`, `created_at`, `player_impact` (jsonb).
  - Totals legs: `selected_team` = `Over`/`Under` (legacy: `Over 224.0 points`), `opponent` = `Home vs Away`; legacy rows store the combined total in `selected_score` with `opponent_score` 0/null.
  - Both tables have RLS. Never weaken RLS and never put a service-role/secret key in frontend code.
- Settlement rules used by the UI: ticket profit = stored `net_profit` when present, otherwise won → `payout_if_win - stake`, lost → `-stake`, push/void → 0.
  Pending is excluded from settled stats. Win rate = won ÷ (won + lost). Do not change these meanings without asking.

### `bets.player_impact` formats (all must keep working)

| Shape | Example |
|---|---|
| Current | `{"events": [{...}, ...]}` |
| Legacy array | `[{...}, ...]` |
| JSON string of either | `"{\"events\":[...]}"` |
| Single event object | `{"player": "...", "status": "..."}` |
| Legacy name → note map | `{"Player A": "note"}` |
| Legacy plain text | `"free text"` |
| Empty | `null`, `""`, `[]`, `{}`, `{"events": []}` |

Event fields: `player` (may be null), `team` (`data_quality` = a data-quality note, not a team), `status` (free text, English or Thai),
`event_type` (`pre_game_absence`, `pre_game_questionable`, `injury_during_game`, `ejection`; others may appear),
`reason`, `impact`, `report_date`, `source`. Unknown fields may be added later and must still be shown as readable text.
In the new app all parsing goes through `parseImpact()` and all display through `renderImpactEntry()` / `piBlock()` in `app/app-2.js`
(ported from `classic.html`, which keeps its own `parseImpact()` / `renderImpactBlock()`).

## Rules

1. **Inspect before modifying.** Read the relevant code in `index.html` / `app/` and query the real Supabase schema and sample rows (including empty/null rows) before changing anything. Do not assume column names, types or JSON shapes.
2. **Commits go straight to `main` (owner's choice since 2026-11-08) — but only when the owner asks to push.** Never force-push, never rewrite history, never bypass branch protection. Because `main` deploys to GitHub Pages immediately, run every test in "How to test" before pushing. When a change spans several files, push the files the shell depends on first and `index.html` last, so the live site never references a missing file.
3. **Use a branch + pull request only when the owner asks for a review first.** Never replace `index.html` with something that drops existing features or live Supabase loading. Keep `classic.html` working.
4. **Preserve all betting records and Supabase compatibility.** Never truncate, delete, reseed, recreate or bulk-update tables. Never write display values back to the database. No schema changes or migrations unless explicitly requested and justified. Before and after any data-related work, compare row counts and key fields; stop if integrity is in doubt. `private_backup` holds snapshots; take a fresh, verified one before any approved data change.
5. **Normalize external/database data before rendering.** Every value from Supabase or the web goes through a normalizer that tolerates null, empty, wrong types and malformed JSON, and every value is HTML-escaped (`esc()`) before it is put into HTML. Links must pass `safeUrl()` / `piSafeUrl()` (http/https only).
6. **Never render raw JSON objects or arrays in the UI.** No `JSON.stringify` output, no `[object Object]`, no serialized arrays. Unknown structures become readable `label: value` text (`textOf()`), or are hidden with a friendly message.
7. **Never invent or infer unverified player-impact events.** Show only what is stored. Never fabricate players, injuries, ejections, availability, sources or dates. An old injury report is not proof that a player missed a specific game (the UI flags reports more than 1 day before game day). Keep pre-game absence, in-game injury and ejection distinct.
8. **Test player-impact inputs:** `null`, `undefined`, `""`, `[]`, `{}`, `{events: []}`, malformed JSON string, legacy array, legacy map, plain text, `{events: [...]}`, JSON string of `{events}`, missing player/optional fields, multiple events, HTML/script-like text, missing/invalid source URL.
9. **Test mobile and desktop layouts.** At least 390×844 (iPhone) and 1280-wide desktop; no horizontal overflow on any view, dialog, slide-over or card.
10. **Check console errors and verify every existing section still works:** Dashboard KPIs and charts (LIN/LOG), scores ticker, Tickets list with status/sort/advanced filters, mobile filter sheet, ticket detail page and slide-over, Games with filters, Player Impact with filters, Analytics with filters, command palette and 1–5 keys, Settings and themes, error/empty/no-config states, and `classic.html`.
11. **Report at the end:** files changed, tests performed with results (and which could not be run), remaining risks, and the commit or PR URL.
12. **Never claim a deployment succeeded unless the live site has been checked** and shows the new version. A successful commit or merge is not a deployment.

## How to test

- Headless Chromium + Playwright is the expected tool. Serve the repo root over a local HTTP server (the loader fetches `app/app-*.js` at runtime) and intercept `**/rest/v1/**`, answering with fixtures exported from the real tables (exclude `tickets.user_id`). That gives real-data checks without a key and without touching the database. Seed `localStorage.nbaTrackerConfig` with a dummy `https://xxxx.supabase.co` URL and `sb_publishable_test` key.
- Check computed numbers (counts, W-L-P, stake, profit, win rate, ROI) against values calculated independently from the same fixtures.
- Search rendered text for `{"`, `[{`, `"events"`, `undefined`, `NaN` and `[object Object]`; any hit is a regression.
- Confirm only GET requests are made and `user_id` is never in a `select=`.
- Validate JS syntax (`node --check app/*.js`), and check there are no duplicate IDs and no missing `#id` references.
