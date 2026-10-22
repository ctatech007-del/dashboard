# CTA Post Tracker

Internal dashboard that tracks Creator Takeoff Academy students' Instagram posting for the
100 Post Challenge. Scope, rules and architecture: see [CLAUDE.md](CLAUDE.md).

## Setup (all on CTA-owned accounts)

### 1. Supabase
1. Create a project (region: Mumbai).
2. Run the migration: `supabase link --project-ref <ref>` then `supabase db push`
   (or paste `supabase/migrations/20261022000000_init.sql` into the SQL editor).
3. **Auth → Providers → Email:** turn off "Allow new users to sign up". Invite each team member
   from **Auth → Users**.
4. Edge Function secrets (**Edge Functions → Secrets**):
   - `APIFY_TOKEN`: from Apify → Settings → Integrations
   - `FUNCTION_SECRET`: any long random string (`openssl rand -hex 32`)
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: the service account key JSON (optional, for Sheet sync)
5. Deploy functions:
   `supabase functions deploy scrape-start scrape-ingest sheets-sync --no-verify-jwt`
   (they authenticate with `FUNCTION_SECRET` instead of a Supabase JWT).
6. Schedule: save the `FUNCTION_SECRET` in Vault as `function_secret`, then run:

```sql
select cron.schedule('cta-weekly-scrape', '30 0 * * 1', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/scrape-start',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-function-secret', (select decrypted_secret from vault.decrypted_secrets
                            where name = 'function_secret')),
    body := '{"trigger":"schedule"}'::jsonb);
$$);
```

`30 0 * * 1` = Monday 00:30 UTC = **Monday 06:00 IST**.

### 2. Google Sheet (optional)
Create a Google Cloud service account with the Sheets API enabled, download its JSON key, share
the Sheet with the service account's email as Editor, and paste the Sheet link in **Settings**.

### 3. Vercel
Import the repo, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`FUNCTION_SECRET` (see `.env.example`), deploy.

## Before go-live
- Run one scrape on 3–5 real handles (one private, one renamed) and check the Apify field names
  in `supabase/functions/_shared/apify.ts` still match the actor output.
- Confirm Trial Reels don't show up in the profile scraper's posts.

## Develop
```bash
npm install
cp .env.example .env.local   # fill in
npm run dev
npm test                      # metric rules against the real schema + scraper parser
```
