# Phantom — AI-Powered X Automation

Phantom is an open-source autonomous X (Twitter) growth agent. It posts tweets, threads, and long-form content; replies to mentions; follows niche accounts; sends DMs; quote-tweets trending posts; and learns from its own performance over time — all with a Telegram-based approval loop so nothing goes out without your OK.

**Self-host free. Hosted at $29/mo.**  
Technical users can run it entirely on their own infrastructure at no cost. Non-technical users can pay for the hosted service (coming soon).

---

## What it does

| Feature | How |
|---|---|
| Tweets & threads | Claude Sonnet drafts content from your brand voice, Telegram asks you to approve or reject |
| Mention replies | Claude Haiku replies to every mention, scoped by your conversation history |
| Auto DMs | Sends targeted DMs to new followers and niche accounts |
| Trending quote-tweets | Finds high-traction posts in AI/web3/automation and quotes them with a value-add comment |
| Niche retweets | Retweets relevant content for consistent topic presence |
| Follow/unfollow | Follows niche accounts by keyword, likes their tweets |
| Long-form posts | Extended tweet-like content for deeper engagement |
| Weekly brain analysis | Claude Opus reviews your week, updates brand voice and strategy automatically |
| Telegram controls | `/pause`, `/resume`, `/kill`, `/queue`, `/activity` — full control from your phone |

---

## Where memory and context live

All data is stored in **PostgreSQL** (Supabase works):

| Table | What's in it |
|---|---|
| `BrainMemory` | 6 persistent KV rows: brand voice, top topics, tone, audience, growth strategy, tweet rules |
| `ConversationThread` | Per-Twitter-user conversation history so replies stay contextual |
| `PerformanceInsight` | Weekly analysis results from Claude Opus — what's working, what to change |
| `Stats` | Running counters: tweets, replies, likes, DMs, follows, rate-limit hits |
| `Activity` | Full action log with icons — visible in Telegram and dashboard |
| `QueueItem` | Pending approvals queue |

Nothing is stored in files or environment variables except credentials (which stay in `.env`).

---

## Self-host setup

### Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase free tier works)
- [cron-job.org](https://cron-job.org) account (free)
- Telegram bot (create via [@BotFather](https://t.me/botfather))
- X (Twitter) account — **no API key needed**, uses browser cookies

### 1. Clone and install

```bash
git clone https://github.com/BigRedDr0id/phantom.git
cd phantom
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Database
DATABASE_URL="postgresql://..."

# X auth — cookie-based (no API key required)
# Extract from browser devtools after logging into x.com
X_AUTH_TOKEN="..."
X_CT0="..."           # CSRF token cookie

# Claude AI
ANTHROPIC_API_KEY="sk-ant-..."

# Telegram
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_CHAT_ID="..."   # Your personal chat ID with the bot

# Cron security
CRON_SECRET="your-random-secret"

# App URL (needed for internal cron dispatch)
NEXTAUTH_URL="https://your-domain.vercel.app"
```

**How to get X cookies:**
1. Log into x.com in Chrome/Firefox
2. Open DevTools → Application → Cookies → `https://x.com`
3. Copy `auth_token` → `X_AUTH_TOKEN`
4. Copy `ct0` → `X_CT0`

Cookies expire every ~30 days. Re-extract and update when automation stops.

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Deploy to Vercel

```bash
npm i -g vercel
vercel link
vercel env pull
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deploys on push.

### 5. Set up the cron job

On [cron-job.org](https://cron-job.org):
1. Create a new job
2. URL: `https://your-domain.vercel.app/api/cron/dispatch`
3. Add header: `Authorization: Bearer <your CRON_SECRET>`
4. Interval: every 15 minutes

That single endpoint fans out to all sub-jobs internally based on IST time slots.

### 6. Register the Telegram webhook

Run once after deploy:

```
GET https://your-domain.vercel.app/api/telegram/setup
Authorization: Bearer <CRON_SECRET>
```

This registers your bot webhook so `/pause`, `/resume`, etc. work from your phone.

---

## Posting schedule (IST)

| Slot | What fires |
|---|---|
| Every 15 min | Mentions, engage, trending quote-tweets |
| 7:30, 12:30, 18:30, 21:30 | Tweet or thread (randomly picked) |
| Mon & Thu 14:30 | Bonus thread |
| 10:28 daily | Long-form post |
| 11:28, 16:28 | Niche retweet |
| 23:28 | Daily summary to Telegram |
| Sunday 23:00 | Brain analysis (Claude Opus, extended thinking) |

---

## SaaS mode (multi-tenant)

Phantom ships with full multi-tenant support. Each user gets:
- Their own X credentials (cookie-based)
- Their own Telegram bot
- Isolated data in every table (`userId` partitioned)
- Independent pause/resume/kill controls

The onboarding wizard (`/onboarding`) walks users through connecting X and Telegram in 4 steps. Stripe handles billing — users with `subscriptionStatus: active | trialing` and completed onboarding are automatically included in every cron dispatch.

To run as a single-user tool (the default), leave SaaS env vars unset — the automation uses `userId: null` which maps to your `.env` credentials.

---

## Tech stack

- **Framework**: Next.js 16 App Router (TypeScript) on Vercel
- **Database**: PostgreSQL via Prisma 7 (Supabase recommended)
- **X client**: `agent-twitter-client` (write) + `@the-convocation/twitter-scraper` (read)
- **AI**: Anthropic Claude — Haiku for replies/DMs, Sonnet for tweets/threads, Opus for brain analysis
- **Telegram**: Bot API with inline keyboards for approve/reject
- **Scheduling**: cron-job.org → single `/api/cron/dispatch` endpoint
- **Auth**: HMAC-SHA256 JWT sessions (SaaS mode)
- **Payments**: Stripe (SaaS mode)

---

## License

[GNU Affero General Public License v3.0](LICENSE)

Free to use, modify, and self-host. If you run a modified version as a public service, you must release your source code under AGPL.
