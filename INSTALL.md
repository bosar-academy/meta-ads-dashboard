# Part 1: What You're Getting

A custom Meta ad analytics dashboard. Replaces Ads Manager for daily review. Pulls live data from Meta + (optional) Airtable, lays AI-generated daily briefings on top, and tracks your campaign against the targets YOU set.

I walk through this dashboard in the Meta Ads + Claude Code video here: https://youtu.be/_TODO_VIDEO_URL_

This is **NOT** a Claude Code skill - it's a full Next.js web app. You install it on your machine (and optionally deploy to Vercel for cloud access). Setup takes 30-60 minutes if you don't have the accounts yet.

## What It Does

Replaces Ads Manager for the operational view. The UI is custom-tuned for the metrics that actually matter:

**Top of view:**
- Today's spend + month-to-date spend
- 7-day CPR with green/yellow/red bands you define
- Learning phase tracker (progress to 50 events/week)
- Decision gate (which decision point you're at based on cumulative spend)

**AI Daily Briefing:**
- One paragraph generated each morning by Claude (Anthropic API)
- Reads your last 7 days of data + your campaign plan + your targets
- Outputs: what happened yesterday, the trend, ads to watch, recommended action, on-track call
- 1-hour cache so it doesn't burn API on every refresh

**Sparkline charts:**
- CPR with your target band overlay
- CPM, link CTR, registrations, frequency, spend
- Hover for daily detail

**Creative leaderboard:**
- Every ad ranked by CPR
- Status badge (winner / performing / watch / too early / cull) using YOUR thresholds
- Thumbnail preview
- Direct link to that exact ad in Ads Manager

**Funnel breakdown:**
- Impressions → link clicks → registrations → calls booked → enrollments
- Pulled from Meta + (optional) Airtable for sales-pipeline attribution
- If Airtable disabled, shows Meta-only funnel (impressions → clicks → registrations)

**Budget What-If Simulator:**
- Plug in a different daily budget
- See projected registrations, calls booked, enrollments at that spend
- Uses your CURRENT funnel conversion rates as the projection basis

**Decision triggers panel:**
- Reads YOUR targets from `lib/targets.ts`
- Shows current CPR vs target band
- Frequency cap alert if approaching creative fatigue
- Learning-phase exit progress
- Decision gate (day 3, day 7, day 14, day 21, day 28 - configurable)

**Generate Next Creative Brief:**
- For winning ads, click to generate new angle variations
- Claude reads what's winning, generates new hooks/angles
- Pipe the brief into `/nano-banana` (skill) to generate the actual statics

**Action log:**
- If Claude Code makes ANY changes to your Meta account via `/meta-ads` (pause, scale, create), they log here for audit

## What's Different vs Ads Manager

- **AI briefing layer** - Ads Manager shows numbers. The dashboard tells you what to DO with them.
- **Faster** - no waiting for Ads Manager's loading spinner. Live pull from Graph API.
- **Tuned to YOUR targets** - decision gates, CPR bands, learning-phase rules are all configurable per campaign.
- **Per-creative verdict** - automatic winner / cull / watch labeling. Ads Manager makes you read the table; this tells you.
- **Sales-pipeline view** (if Airtable enabled) - Ads Manager stops at conversions. The dashboard continues through calls booked + enrollments.

## What You Need

- **Meta Business account + ad account** with active campaigns - https://business.facebook.com
- **System User token** with `ads_management` + `ads_read` scopes (from `cc-meta-tracking-setup`)
- **Custom conversion** configured (the action the dashboard counts as "registration")
- **Anthropic API key** (for the AI Daily Briefing) - https://console.anthropic.com
- **Node.js 20+** + **npm** on your machine
- **Vercel account** (free tier) if you want cloud deployment
- **Turso account** (free tier) if you want a hosted DB for Vercel deploy - https://turso.tech
- **(Optional) Airtable** for sales-pipeline attribution
- **Claude Code** for the install prompt - https://claude.ai/code

## Cost

| Item | Cost |
|---|---|
| The dashboard | $0 (open source, self-hosted) |
| Anthropic API | ~$0.10-$0.50/day (1 briefing per day, cached 1h) |
| Turso DB | Free tier covers it |
| Vercel hosting | Free tier covers it |
| Meta API | Free |

## Heads Up

- **The dashboard is password-protected.** You set the password during install.
- **AI quality scales with how much context you give it.** Fill out `public/plan.md` with your real campaign brief (or paste your `/ad-strategy` output) for sharper daily briefings.
- **Decision thresholds are YOURS to set.** The default `lib/targets.ts` values are placeholders for a typical $50/day campaign targeting $30 CPR. Replace with your actual unit economics during install (or edit the file later).
- **First sync takes ~30 seconds.** The dashboard pulls 30 days of historical data on first load. Subsequent syncs are fast.

---

# Part 2: Copy-Paste This Into Claude Code

```
I want you to install the meta-ads-dashboard Next.js app from https://github.com/bosar-academy/meta-ads-dashboard and walk me through complete setup including deployment.

Step 1 - Clone the repo:

Ask me where I want to clone it (default: ~/Projects/meta-ads-dashboard). Then run:
  git clone https://github.com/bosar-academy/meta-ads-dashboard <path>
  cd <path>
  npm install

This takes 1-2 minutes.

Step 2 - Set up .env.local:

Copy .env.example to .env.local:
  cp .env.example .env.local

Then interview me one variable at a time:

1. DASHBOARD_PASSWORD - ask me to choose a password for the dashboard login. Generate a strong one if I want.

2. ANTHROPIC_API_KEY - tell me to grab one at https://console.anthropic.com and paste it. Required for the AI Daily Briefing.

3. META_MARKETING_TOKEN - tell me to either:
   (a) paste it directly, OR
   (b) read it from ~/.config/meta/credentials (if I ran cc-meta-tracking-setup already)

4. META_AD_ACCOUNT_ID - format act_XXXXXXXXX. Tell me to find it at business.facebook.com/adsmanager → look at URL.

5. META_CAMPAIGN_ID (optional) - ask if I have a specific campaign to track. If yes, paste the ID. If no, skip (dashboard rolls up full account).

6. META_CUSTOM_CONVERSION_ID (optional) - if I have a custom conversion the dashboard should count as registrations. From Events Manager → Custom Conversions.

7. META_CAMPAIGN_LAUNCH_DATE (optional) - YYYY-MM-DD if I have a launch date. Used for "days since launch" + learning-phase status.

8. AIRTABLE_ENABLED - ask if I track sales pipeline (calls booked, enrollments) in Airtable. If yes, set to true and ask for AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_REGISTRATIONS_TABLE_ID, AIRTABLE_LEADS_TABLE_ID. If no, leave AIRTABLE_ENABLED=false and skip the rest.

9. CRON_SECRET - generate a random string (32 chars). Used for Vercel cron auth.

Write all answers to .env.local.

Step 3 - Set up the campaign plan:

Ask me:
"Do you want to:
(a) Paste your /ad-strategy output here (best - most context for AI briefings)
(b) Fill the template manually (still good)
(c) Skip - use generic placeholder for now and fill in later"

Based on my choice:
  (a) Take the strategy file content, save to public/plan.md
  (b) Copy public/plan.md.template to public/plan.md and walk me through filling each {PLACEHOLDER}
  (c) Copy public/plan.md.template to public/plan.md unchanged - I'll fill later

Step 4 - Set up campaign targets:

Open lib/targets.ts and ask me:
"The defaults are placeholders for a $50/day cold lead-gen campaign targeting $30 CPR. Want to:
(a) Keep defaults for now (you can edit anytime)
(b) Customize now - I'll ask you for your CPR bands, CAC range, decision gates"

If (b), interview me through:
- Daily budget (in dollars - you'll convert to cents)
- Monthly budget cap
- CPR green band (under what $ is "on track")
- CPR yellow band (what $ range is "watch")
- CPR red band (above what $ is "kill")
- CAC target range
- Decision gate timeline (when to check in: day 3? day 7? day 14? day 21? day 28?)

Update lib/targets.ts with my values.

Step 5 - Set up the database:

Ask me: "Do you want to deploy this to Vercel + Turso (cloud, recommended for production), or run locally only?"

If LOCAL:
  DATABASE_URL="file:./dev.db" npx prisma generate
  DATABASE_URL="file:./dev.db" npx prisma db push

If CLOUD (Turso):
  Tell me to:
    1. Create free account at https://turso.tech
    2. Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
    3. Run `turso auth login`
    4. Provision DB: `turso db create meta-ads-dashboard`
    5. Get URL: `turso db show meta-ads-dashboard --url`
    6. Generate token: `turso db tokens create meta-ads-dashboard`
    7. Paste URL + token back to me
  Update .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN + set DATABASE_URL=TURSO_DATABASE_URL
  Then run:
    TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... DATABASE_URL=... npx prisma db push

Step 6 - Smoke test locally:

  npm run dev

Open http://localhost:3000 in my browser. I should see the login page. Log in with DASHBOARD_PASSWORD.

Then trigger a sync:
  curl -X POST http://localhost:3000/api/refresh

Wait 30 seconds for the initial Meta data pull. Refresh the dashboard. Confirm:
- Scorecard shows numbers (not zeros)
- Sparkline charts render
- Creative leaderboard shows ads (if any active in last 30 days)
- AI Daily Briefing renders text after a few seconds

If I see all that, the local setup works.

Step 7 - Deploy to Vercel (optional):

If I chose cloud earlier, walk me through:
  1. Push code to GitHub: ask me to create a private repo `meta-ads-dashboard` under my own account, then:
     git remote add origin git@github.com:ME/meta-ads-dashboard.git
     git push -u origin main
  2. Go to vercel.com → New Project → Import from GitHub → select my repo
  3. Set Environment Variables - copy ALL values from my .env.local (the wizard makes me paste each)
  4. Deploy
  5. Once deployed, smoke-test:
     curl https://<my-vercel-url>/api/cron/sync-meta -H "Authorization: Bearer $CRON_SECRET"
  6. Log in to my deployed dashboard at https://<my-vercel-url>

Step 8 - Confirm I'm ready:

Tell me the dashboard is set up. Remind me:

- Local URL: http://localhost:3000 (run `npm run dev` to start)
- Deployed URL: https://<my-vercel-url> (if deployed)
- Login: my DASHBOARD_PASSWORD
- Daily briefing regenerates every morning automatically (Vercel cron) or on /api/refresh trigger
- Customize public/plan.md anytime my campaign brief changes
- Customize lib/targets.ts anytime my CPR bands or unit economics change

Also tell me how this dashboard pairs with the rest of the Meta Ads bundle:
- /meta-ads creates campaigns - this dashboard tracks them
- /ad-strategy produces the campaign brief - paste it into public/plan.md for sharper AI briefings
- /nano-banana generates the creatives - this dashboard ranks them
- /competitor-discovery + /funnel-spy inform the strategy upstream

That's it - the dashboard replaces Ads Manager for daily review.
```
