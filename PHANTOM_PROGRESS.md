# Phantom — Project Progress Document
**Status as of:** June 3, 2026  
**Live at:** https://phantom-beige.vercel.app  
**Repo:** https://github.com/Bigreddroid/phantom (private)  
**Telegram Bot:** @phantomioBot

---

## What Is Phantom

Phantom is a fully automated AI personal brand system for X (Twitter). It runs 24/7 with zero human intervention — posting original content, engaging with niche accounts, replying to mentions, and following relevant creators, all in a human-like pattern.

It is the first product of **Project Z** — a 90+ niche automation platform.

The operator controls everything through a **Telegram bot** that acts as a secretary dashboard. No approvals, no queues — everything fires automatically and sends notifications after the fact.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| Database | Supabase PostgreSQL via Prisma v7 + `@prisma/adapter-pg` |
| X API | Twitter API v2 (OAuth 1.0a) via `twitter-api-v2` |
| AI — Primary | xAI Grok (`grok-3`) via OpenAI-compatible SDK |
| AI — Fallback | Anthropic Claude (`claude-sonnet-4-6`) |
| Notifications | Telegram Bot API (webhook mode) |
| Scheduling | GitHub Actions (free tier, every 30 min) |
| Hosting | Vercel (Hobby plan, production alias: phantom-beige.vercel.app) |
| Image Generation | `@vercel/og` (edge runtime, 1200×630 branded cards) |

---

## Environment Variables

All personal data lives in env vars — nothing is hardcoded in the repo.

### Required
```
X_API_KEY
X_API_SECRET
X_BEARER_TOKEN
X_ACCESS_TOKEN
X_ACCESS_TOKEN_SECRET
X_CLIENT_ID
X_CLIENT_SECRET
ANTHROPIC_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL=https://phantom-beige.vercel.app  ← must be production URL on Vercel
CRON_SECRET
```

### Optional / Personalisation
```
GROK_API_KEY          # xAI Grok — falls back to Claude if not set
X_HANDLE              # e.g. @yourusername — used in prompts, OG image, status
NEXT_PUBLIC_X_HANDLE  # same, for client-side dashboard
BLOCKED_USERNAMES     # comma-separated — accounts Phantom silently skips
BLOCKED_IDS           # comma-separated Twitter user IDs to skip
```

> **Critical:** NEXTAUTH_URL must be `https://phantom-beige.vercel.app` on Vercel (not localhost). All internal bot commands break if it points to localhost. Set per-environment via Vercel REST API to avoid BOM encoding issues.

> **BOM Warning:** Never set Vercel env vars via PowerShell pipe (`echo | vercel env add`). Always use the Vercel REST API via Node.js to avoid UTF-8 BOM (U+FEFF) corruption that breaks X API OAuth.

---

## Architecture — API Routes

### Cron Routes (called by GitHub Actions)
| Route | Schedule | What it does |
|---|---|---|
| `GET /api/cron/engage` | Every 30 min, 24/7 | Like + reply (40% rate). Day mode (7am–10pm IST): like + reply. Night mode: likes only. |
| `GET /api/cron/follow` | 9:30am, 3:30pm, 8:30pm IST | Follow niche accounts + like + reply to ~40% |
| `GET /api/cron/mentions` | Every 30 min, 24/7 | Auto-reply to all @mentions |
| `GET /api/cron/tweet` | 7:30am, 12:30pm, 6:30pm, 9:30pm IST | Auto-post tweet (30% chance of branded image, 15% skip) |
| `GET /api/cron/thread` | Mon & Thu 2:30pm IST | Auto-post 5-tweet thread (20% skip) |
| `GET /api/cron/watchdog` | Every hour | Self-heals if no DB activity in 90 min. Also re-registers Telegram webhook. |
| `GET /api/cron/summary` | 11:30pm IST | Daily Telegram summary report |

### Job Routes (called by Telegram bot)
| Route | Method | What it does |
|---|---|---|
| `POST /api/jobs/tweet` | POST | Generate + post tweet immediately |
| `POST /api/jobs/thread` | POST | Generate + post thread immediately |
| `POST /api/jobs/engage` | POST | Run engagement pass immediately |
| `POST /api/jobs/follow` | POST `{ count: n }` | Follow n accounts immediately |
| `POST /api/jobs/mentions` | POST | Reply to all mentions immediately |

### Other Routes
| Route | What it does |
|---|---|
| `POST /api/telegram` | Webhook receiver for Telegram bot |
| `GET /api/og` | Branded tweet image (1200×630, edge runtime) |
| `GET /api/stats` | Live X account stats |
| `GET /api/activity` | Recent activity from DB |
| `GET /api/queue` | Content queue |

---

## Telegram Bot Commands

Set via `setMyCommands` — appear in the bot's `/` menu.

| Command | What it does |
|---|---|
| `/status` | Live stats — followers, following, tweets, posts, replies |
| `/activity` | Last 10 actions Phantom took (with timestamps) |
| `/tweet` | Generate & post tweet now (inline: text \| image) |
| `/thread` | Generate & post 5-tweet thread now |
| `/post <text>` | Post your own custom tweet instantly |
| `/engage` | Run engagement — like + reply (10:1 verified ratio) |
| `/follow [n]` | Follow n niche accounts + like + reply |
| `/mentions` | Auto-reply to all current mentions |
| `/schedule` | Show full automation schedule |
| `/pause` | Mark automation as paused (note: GitHub Actions still runs) |
| `/resume` | Mark automation as resumed |
| `/blacklist <username>` | Log account to skip — add to BLOCKED_USERNAMES env var to activate |
| `/help` | Show all commands |

---

## Key Systems

### Engagement Logic
- **10:1 verified:non-verified ratio** — searches `is:verified` for 10 accounts, then 1 non-verified
- **Blocklist** — reads `BLOCKED_USERNAMES` and `BLOCKED_IDS` env vars at runtime. Applied in engage, follow, and mentions routes. One-directional: they can see your account, Phantom ignores theirs.
- **Day/night mode** — 7am–10pm IST: like + reply. 10pm–7am IST: likes only.
- **Human delays** — `randomDelay()` between every action (800ms–5000ms) to avoid rate limits

### Content Generation
- Grok (`grok-3`) is primary when `GROK_API_KEY` is set — better for X-native content
- Claude (`claude-sonnet-4-6`) is fallback
- Voice prompt: direct, confident, no fluff, no emojis unless natural, sounds like a real person thinking out loud
- Topics: personal branding, AI automation, building in public, solopreneur life

### Telegram Notifications — Per Action
Every significant action sends an individual Telegram message:
- **Comment posted** — shows the original tweet + the reply text
- **Mention replied** — shows the mention + the reply text
- **Follow run** — summary of followed/liked/replied counts
- **Tweet posted** — tweet content + whether image was attached
- **Watchdog fired** — if silent for 90 min, alerts and restarts

### Self-Healing Watchdog
- Runs every hour via GitHub Actions
- Checks DB for any activity in the last 90 minutes
- If silent: fires `/api/cron/engage` and `/api/cron/mentions`
- Sends Telegram alert
- Also calls `ensureWebhook()` — re-registers Telegram webhook if URL changed

### Telegram Webhook Auto-Registration
- `src/lib/telegram/setup.ts` — `ensureWebhook()` is idempotent
- Called on every engage cron run (every 30 min) and every watchdog run (every hour)
- Checks current webhook URL, re-registers if missing or stale
- No manual setup needed after first deploy

### OG Image Generation
- Route: `GET /api/og?text=...`
- Edge runtime, `@vercel/og` / Satori
- 1200×630, dark gradient background
- Blue accent bar, large tweet text with proper `wordBreak: "break-word"`, branded footer with handle and X logo
- Handle pulled from `X_HANDLE` env var
- Twitter v1.1 media upload (for attaching to tweets) requires **Elevated API access** — not available on free Basic plan. Currently falls back to text-only. Upgrade plan at developer.twitter.com to unlock image tweets.

---

## GitHub Actions Scheduler

File: `.github/workflows/scheduler.yml`  
Triggers: every 30 minutes, 24/7  
GitHub repo secret required: `APP_URL` and `CRON_SECRET`

```
Every 30 min:   Mentions + Engagement
9:30am IST:     Follow run
3:30pm IST:     Follow run
8:30pm IST:     Follow run
7:30am IST:     Tweet
12:30pm IST:    Tweet
6:30pm IST:     Tweet
9:30pm IST:     Tweet
2:30pm IST Mon: Thread
2:30pm IST Thu: Thread
Every hour:     Watchdog
```

---

## Database Schema (Prisma)

Key models in use:
- `Activity` — logs every action (action, detail, icon, createdAt)
- `Queue` — content queue items with status (PENDING/APPROVED/REJECTED/POSTED)

Config: `prisma.config.ts` with `@prisma/adapter-pg`. No `url` in `schema.prisma` — connection handled via adapter.

---

## Known Limitations / To Upgrade Later

1. **Image tweets require Twitter Elevated API access** — free Basic plan only has v2. Upgrade at developer.twitter.com → Products → Elevated. Until then, `postTweetWithImage` falls back to text-only gracefully.
2. **Grok API key not yet set** — get from console.x.ai. Set as `GROK_API_KEY` on Vercel. Until then, Claude handles all generation.
3. **LinkedIn automation** — mentioned, not built.
4. **Reddit integration** — mentioned, not built.
5. **`/pause` command** — logs to DB but doesn't actually stop GitHub Actions. To fully pause, disable the workflow at github.com/Bigreddroid/phantom/actions.
6. **`/blacklist` command** — logs the username to DB but you still have to manually add it to `BLOCKED_USERNAMES` env var on Vercel + redeploy for it to take effect.

---

## File Structure (Key Files)

```
src/
  app/
    api/
      cron/
        engage/route.ts     # Like + reply, day/night mode
        follow/route.ts     # Follow + like + reply, 3x/day
        mentions/route.ts   # Auto-reply to mentions
        tweet/route.ts      # Auto-post tweet
        thread/route.ts     # Auto-post thread
        watchdog/route.ts   # Self-healing, webhook check
        summary/route.ts    # Daily Telegram summary
      jobs/
        engage/route.ts     # Manual engage via bot
        follow/route.ts     # Manual follow via bot
        mentions/route.ts   # Manual mentions via bot
        tweet/route.ts      # Manual tweet via bot
        thread/route.ts     # Manual thread via bot
      og/route.tsx          # Branded tweet image (edge)
      stats/route.ts        # Live X stats
      telegram/route.ts     # Bot webhook — all commands
  lib/
    x/
      client.ts             # twitter-api-v2 OAuth client
      engage.ts             # searchTweets, likeTweet, followUser, getMentions, getMyProfile
      post.ts               # postTweet, postTweetWithImage, replyToTweet, postThread
    claude/
      generate.ts           # Grok (primary) + Claude (fallback), voice prompt
    telegram/
      notify.ts             # sendMessage, notifyPosted, notifyError, etc.
      setup.ts              # ensureWebhook() — idempotent webhook registration
    blocklist.ts            # isBlocked() — reads BLOCKED_USERNAMES/BLOCKED_IDS env vars
    db.ts                   # Prisma client singleton
    scheduler/
      humanize.ts           # randomDelay, shouldSkip, humanPause
      jobs.ts               # Legacy job runners (kept for reference)
.github/
  workflows/
    scheduler.yml           # GitHub Actions 24/7 cron
scripts/
  setup-telegram.mjs        # One-time manual webhook setup (no longer needed)
```

---

## Continue From Here

### Immediate next steps:
1. **Set `GROK_API_KEY`** — get from console.x.ai, set on Vercel as `GROK_API_KEY`. This makes content sound more X-native.
2. **Add blocked usernames** — add to `BLOCKED_USERNAMES` env var on Vercel (comma-separated). The `/blacklist` bot command logs them, but you still need to add to env manually.
3. **Upgrade Twitter API to Elevated** — unlocks v1.1 media upload so the 30% image chance actually works.
4. **Add GitHub Actions secrets** — ensure `APP_URL=https://phantom-beige.vercel.app` and `CRON_SECRET` are set in repo Settings → Secrets → Actions.
5. **LinkedIn automation** — build `src/app/api/cron/linkedin/route.ts` using LinkedIn API or a scraping approach.
6. **Reddit integration** — build `src/app/api/cron/reddit/route.ts` — post to relevant subreddits.
7. **`/pause` fully stops automation** — need to implement a DB flag that all cron routes check before executing, so GitHub Actions can run but Phantom skips all work.
8. **`/blacklist` auto-activates** — instead of requiring manual env var update, store blocklist in DB and have `isBlocked()` query the DB.

### Sessions to review:
- Session 1 (previous): X API BOM fix, secretary mode, 24/7 loop, Grok, blocklist, image support
- Session 2 (this): NEXTAUTH_URL fix, git email fix (Vercel BLOCKED), comments fix (missing import), follow split, OG image redesign, name removal, Telegram command list
