# Phantom

> Your personal brand on autopilot.

Phantom is an AI system that runs your X (Twitter) presence 24/7 — posting content in your voice, engaging with your niche, responding to mentions, and generating leads while you focus on building.

Built for founders and creators who know their personal brand should be generating leads, but don't have time to be consistent.

---

## What it does

**Content** — Generates and posts tweets and threads in your voice using Claude AI. Runs on a schedule with human-like randomization so it never looks like a bot.

**Engagement** — Automatically likes and engages with tweets from your target niche throughout the day.

**Mentions** — Reads every mention, drafts a contextual reply using AI, and queues it for your approval.

**Approval gate** — Anything important gets sent to your Telegram with one-tap Approve / Edit / Reject buttons. Everything routine runs automatically.

**Dashboard** — A clean web interface showing live stats, the approval queue, and activity log. Auto-refreshes every 15 seconds.

**Daily summary** — Telegram notification every evening with follower count, tweets posted, engagements, and milestones.

---

## Tech stack

- **Next.js 16** — App Router, TypeScript, Tailwind CSS
- **Prisma 7** — ORM with PostgreSQL (Supabase)
- **X API v2** — OAuth 1.0a + 2.0 via `twitter-api-v2`
- **Anthropic Claude** — `claude-sonnet-4-6` for content generation
- **Telegram Bot API** — approval notifications with inline keyboards
- **Vercel** — hosting + cron jobs

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Bigreddroid/phantom
cd phantom
npm install
```

### 2. Environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `X_API_KEY` / `X_API_SECRET` | [developer.x.com](https://developer.x.com) → your app → Keys & Tokens |
| `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` | Same page → Generate Access Token |
| `X_BEARER_TOKEN` | Same page → App-Only Authentication |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | Same page → OAuth 2.0 Keys |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` |
| `TELEGRAM_CHAT_ID` | [@userinfobot](https://t.me/userinfobot) on Telegram |
| `DATABASE_URL` | [supabase.com](https://supabase.com) → project → Connect → ORM → Prisma |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXTAUTH_SECRET` | Same as above |

### 3. Database

```bash
npx prisma db push
npx prisma generate
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment

```bash
vercel --prod
```

Add all environment variables in Vercel → **Settings → Environment Variables**.

---

## Automation schedule (IST)

| Job | Schedule | Notes |
|---|---|---|
| Tweets | 7:30am · 12:30pm · 6:30pm | 15% skip chance |
| Threads | Mon & Thu 2:30pm | 20% skip chance |
| Engagement | Every 2h, 7am–10pm | Active hours only |
| Mentions | Every 30 minutes | Replies queued for approval |
| Daily summary | 11:30pm | Sent to Telegram |

---

Built by [@BigRedDr0id](https://x.com/BigRedDr0id) — building in public.
