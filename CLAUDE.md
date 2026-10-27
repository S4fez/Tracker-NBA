# NBA Bet Tracker: rules for Claude

Read this file before every change to this repository. These rules are permanent and override defaults.
Priority when rules pull against each other: **data integrity → security → correctness → existing functionality → UI**.

## Project facts

- Single-page app: everything lives in `index.html` (HTML + CSS + vanilla JS). No framework, no build step, no new dependencies unless truly necessary.
- Hosted on GitHub Pages from `main`: https://s4fez.github.io/Tracker-NBA/
- Data: Supabase project `bogxjsanowvweirywrmw`, read through the REST API with a **publishable key only** (entered by the user in ⚙ Settings, kept in that browser's localStorage). The app is read-only: it never inserts, updates or deletes.
- Tables:
  - `public.tickets`: `id`, `ticket_code`, `bet_date`, `stake`, `payout_if_win`, `status` (`pending|won|lost|void|partial`), `net_profit`, `created_at`, `user_id`.
    The frontend selects named columns so `user_id` is never downloaded.
  - `public.bets`: `id`, `ticket_id` → `tickets.id`, `selected_team`, `opponent`, `spread`, `odds`, `selected_score`, `opponent_score`,
    `result` (`pending|won|lost|push|void`), `reference_code`, `game_date`, `created_at`, `player_impact` (jsonb).
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
All parsing goes through `parseImpact()` / `normalizeImpact()`; all display goes through `renderImpactEntry()` / `renderImpactBlock()`.

## Rules

1. **Inspect before modifying.** Read the relevant code in `index.html` and query the real Supabase schema and sample rows (including empty/null rows) before changing anything. Do not assume column names, types or JSON shapes.
2. **Keep `main` unchanged until a reviewed PR is merged.** Never commit or push directly to `main`, never force-push, never rewrite history, never bypass branch protection.
3. **Work on a dedicated branch** (e.g. `fix/...`, `feat/...`) and open a pull request into `main`. Do not merge or deploy until the owner has reviewed and approved it.
4. **Preserve all betting records and Supabase compatibility.** Never truncate, delete, reseed, recreate or bulk-update tables. Never write display values back to the database. No schema changes or migrations unless explicitly requested and justified. Before and after any data-related work, compare row counts and key fields; stop if integrity is in doubt. `private_backup` holds snapshots; take a fresh, verified one before any approved data change.
5. **Normalize external/database data before rendering.** Every value from Supabase or the web goes through a normalizer that tolerates null, empty, wrong types and malformed JSON, and every value is HTML-escaped (`esc()`) before it is put into HTML. Links must pass `safeUrl()` (http/https only).
6. **Never render raw JSON objects or arrays in the UI.** No `JSON.stringify` output, no `[object Object]`, no serialized arrays. Unknown structures become readable `label: value` text (`textOf()`), or are hidden with a friendly message.
7. **Never invent or infer unverified player-impact events.** Show only what is stored. Never fabricate players, injuries, ejections, availability, sources or dates. An old injury report is not proof that a player missed a specific game (the UI flags reports more than 1 day before game day). Keep pre-game absence, in-game injury and ejection distinct.
8. **Test player-impact inputs:** `null`, `undefined`, `""`, `[]`, `{}`, `{events: []}`, malformed JSON string, legacy array, legacy map, plain text, `{events: [...]}`, JSON string of `{events}`, missing player/optional fields, multiple events, HTML/script-like text, missing/invalid source URL.
9. **Test mobile and desktop layouts.** At least 390×844 (iPhone) and 1280-wide desktop; no horizontal overflow on any view, dialog or card.
10. **Check console errors and verify every existing section still works:** Dashboard stats and chart, Tickets list, filters and detail sheet, Games & Player Impact with filters and search, Analytics with filters, Settings and themes, error and empty states.
11. **Report at the end:** files changed, tests performed with results (and which could not be run), remaining risks, and the PR URL.
12. **Never claim a deployment succeeded unless the live site has been checked** and shows the new version. A successful commit or merge is not a deployment.

## How to test

- Headless Chromium + Playwright is the expected tool. Serve `index.html` from disk and intercept `**/rest/v1/**`, answering with fixtures exported from the real tables (exclude `tickets.user_id`). That gives real-data checks without a key and without touching the database.
- Check computed numbers (counts, W-L-P, stake, profit, win rate, ROI) against values calculated independently from the same fixtures.
- Search rendered text for `{"`, `[{`, `"events"` and `[object Object]`; any hit is a regression.
- Validate JS syntax (`node -e "new Function(<script body>)"`), and check there are no duplicate IDs and no missing `#id` references.
