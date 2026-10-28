# CTA Post Tracker

Internal dashboard that tracks Creator Takeoff Academy students' Instagram posting for the
100 Post Challenge. Scope, rules and architecture: see [CLAUDE.md](CLAUDE.md).

## Setup (all on CTA-owned accounts)

### 1. Supabase
1. Create a project (region: Mumbai).
2. Run the migrations: `supabase link --project-ref <ref>` then `supabase db push`
   (or paste each file in `supabase/migrations/`, in order, into the SQL editor).
3. **Auth → Providers → Email:** turn off "Allow new users to sign up", and turn on leaked
   password protection. Invite each team member from **Auth → Users**.
   - **Auth → URL Configuration:** Site URL = the Vercel URL (e.g. `https://cta-tracker.vercel.app`).
   - **Auth → Email Templates:** point the links at the app so invites and resets work:
     - *Invite user:* `<a href="{{ .SiteURL }}/login/confirm?token_hash={{ .TokenHash }}&type=invite">Accept the invite</a>`
     - *Reset password:* `<a href="{{ .SiteURL }}/login/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>`
4. Edge Function secrets (**Edge Functions → Secrets**):
   - `APIFY_TOKEN`: from Apify → Settings → Integrations
   - `FUNCTION_SECRET`: any long random string (`openssl rand -hex 32`)
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: the service account key JSON (optional, for Sheet sync)
   - `RESEND_API_KEY` and `ALERT_FROM` (optional, for failure alert emails): a Resend API key
     and a sender on a domain verified in Resend, e.g. `CTA Tracker <alerts@creatortakeoff.com>`.
     Then add the recipients in the app under **Settings → Alert emails**.
5. Deploy functions:
   `supabase functions deploy scrape-start scrape-ingest sheets-sync health rename-verify --no-verify-jwt`
   (they authenticate with `FUNCTION_SECRET` instead of a Supabase JWT).
6. Schedule: save the `FUNCTION_SECRET` in Vault as `function_secret`, then run:

```sql
select cron.schedule('cta-weekly-scrape', '30 0 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/scrape-start',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-function-secret', (select decrypted_secret from vault.decrypted_secrets
                            where name = 'function_secret')),
    body := '{"trigger":"schedule"}'::jsonb);
$$);
```

`30 0 * * *` = 00:30 UTC = **06:00 IST every day**. (The job keeps its original name; the time can
be changed later under Settings → Daily scrape.)

### Student Hub
The public Hub lives at `/hub` on the same deployment (no login): share that one link on Heartbeat.
Students open their page by typing their exact handle; `/hub/<handle>` can be bookmarked. It reads
only through the `hub_*` database functions, never the tables.

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
