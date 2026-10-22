# CTA Post Tracker — Student Stats (Phase 1)

Internal, login-protected tool for Creator Takeoff Academy's team to track students' Instagram
posting for the 100 Post Challenge. This file is the source of truth for scope. Read it before
changing anything.

## Agreed scope (₹45K build — do NOT expand without a change request)

- Scrape each active student's **public** Instagram profile on a schedule (default: weekly,
  Monday 06:00 IST; configurable in `settings.scrape_cron`).
- Count **feed posts only** (images, carousels, reels on the grid). Stories are never tracked.
  A carousel = 1 post. Posts counted from the student's `start_date`.
- Per student: posts this week, running total since start, streak, milestones, batch rank.
- **Streak** = consecutive weeks (Mon–Sun, IST) with ≥ `settings.streak_threshold` posts.
  The current, still-running week does not break a streak.
- **Milestones** at `settings.milestones` (default 10/25/50/75/100). Stored once with
  the date reached; never removed.
- **Leaderboard per batch**: students are only ranked against their own batch.
- **Flags**: private, not found (renamed/deleted), and scrape errors are shown, never silently
  skipped. A failed scrape never repeats the last value.
- **Team UI** (Supabase Auth, team members only): batch leaderboard, student week-by-week
  history with post links, flags list, roster (add/edit/pause/remove + CSV upload),
  re-run button, CSV export, settings.
- **Google Sheet sync** after every run: tabs Leaderboard, Weekly, Milestones, Flags
  (read-only output; overwritten each run).

## Out of scope (Phase 2 / change request — see brief dated Oct 2026)

Student-facing hub (public leaderboards, search, 100 Post page, Passport + stamps), daily
scraping, follower tracking, reel views, Heartbeat, contact log, contract data, frozen months,
charts. The schema leaves room for these (`students.ig_user_id`, `posts.raw`) but none are built.

## Stack

| Part | Tool |
| --- | --- |
| Web UI | Next.js 15 (App Router) on Vercel, Tailwind v4 |
| Auth + DB | Supabase (Postgres, Auth, RLS) |
| Scheduler | Supabase `pg_cron` + `pg_net` → Edge Function |
| Scraping | Apify `apify/instagram-profile-scraper` (+ `apify/instagram-post-scraper` overflow) |
| Reporting | Google Sheets API (service account) |

All accounts are client-owned.

## Pipeline

1. `pg_cron` calls Edge Function `scrape-start`.
2. `scrape-start` creates a `scrape_runs` row and starts the Apify profile scraper for all
   active handles with a webhook to `scrape-ingest?run=<id>`.
3. `scrape-ingest` reads the dataset, matches profiles by handle, and checks the Instagram
   numeric ID against `students.ig_user_id` (a handle now owned by someone else is flagged,
   not ingested; a renamed account shows as `not_found` until the team updates the handle in the
   roster, and its history stays on the same student). It then upserts posts, writes `scrape_results` (status per student), runs the
   overflow scrape for anyone with all 12 latest posts newer than their last check, then calls
   `recompute_metrics()` and `sheets-sync`.
4. Metrics live in `student_metrics` (one row per student) and `weekly_stats`.

Metric logic lives in SQL (`recompute_metrics()` in the migration). `npm test` runs the real
migration in embedded Postgres (PGlite) and checks every rule above, plus the Apify parser in
`supabase/functions/_shared/apify.ts`. Run it after any change to either.

## Conventions

- All week and date boundaries use **Asia/Kolkata**.
- Students have a fixed UUID; the Instagram handle is a mutable attribute.
- Never hard-delete students or posts from the UI: `status = 'removed'`.
