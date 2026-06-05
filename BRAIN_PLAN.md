# Phantom Brain — Memory, Context & Conversation Plan

## The Problem

Every Claude call today is stateless. `generate.ts` gets a topic, fires a prompt, returns text.
Claude has no idea:
- What Phantom is, why it exists, or who runs it
- What was posted in the last 7 days and what flopped
- That it already replied to @user3 an hour ago on a different thread
- The account's current goal or focus
- What tone is working vs. being ignored

When 3 people mention the account simultaneously, Claude generates 3 independent replies with zero
awareness of each other — potentially contradicting itself, repeating lines, or drifting voice.

---

## Architecture: 3 Phases

### Phase 1 — Brand Memory (inject into every call)

**What it does:** Every single Claude generation call gets a rich "brain context" block prepended
to its system prompt. Claude always knows who it is, what it's building, and what matters right now.

**New DB table:**
```prisma
model BrainMemory {
  key       String   @id       // "voice", "purpose", "focus", "avoid", "wins", "notes"
  value     String
  updatedAt DateTime @updatedAt
}
```

**New file: `src/lib/brain/context.ts`**
```typescript
// getBrainContext() — pulls BrainMemory rows, formats as system prompt prefix
// Cached in-memory for 5 min (avoids a DB hit on every generation)
export async function getBrainContext(): Promise<string>

// Default values if no DB entry exists (bootstrapped on first call)
const DEFAULTS = {
  purpose:  "Phantom is an AI system that automates X/Twitter presence for @BigRedDr0id — posting, engaging, replying, DMs — 24/7 via Telegram. Part of BigRedDroid, a solo deep-tech lab building 92 products.",
  voice:    "Direct, confident, no fluff. Solo founder thinking out loud. Technical but not academic. Varies sentence length. Never sounds like a bot or a marketing post. Occasionally dry humour.",
  focus:    "Growing Phantom waitlist. Building in public. Documenting the journey of automating personal brand at scale.",
  avoid:    "Generic productivity takes. Corporate tone. Repeating angles already covered. Motivational filler. Overusing 'game-changer' or 'revolutionary'.",
  wins:     "",   // updated manually or by performance cron
  notes:    "",   // freeform scratchpad
}
```

**Changes to `generate.ts`:**
Every function (`generateTweet`, `generateThread`, `generateReply`, etc.) calls `getBrainContext()`
and prepends the result to the system prompt. One call per generation, cached, adds ~0ms overhead.

**New Telegram command: `/context`**
```
/context                     — show all brain fields
/context set voice <text>    — update a specific field
/context set focus <text>
/context set avoid <text>
/context set wins <text>
/context set notes <text>
/context reset               — wipe to defaults
```

**Prisma migration required:** Add `BrainMemory` model, run `prisma migrate`.

---

### Phase 2 — Conversation Thread Memory

**What it does:** When Claude replies to a mention from @user, it sees the full conversation
history with that person — not just the one tweet. Replies feel like a continuation, not a cold
restart. Prevents contradictions across simultaneous threads.

**New DB table:**
```prisma
model ConversationThread {
  id              String   @id @default(cuid())
  twitterUserId   String   @unique
  twitterUsername String
  messages        Json     // [{role: "them"|"us", content: string, tweetId: string, at: ISO}]
  updatedAt       DateTime @updatedAt
}
```

**New functions in `src/lib/brain/context.ts`:**
```typescript
// Fetch last N exchanges with a Twitter user
export async function getThread(twitterUserId: string, limit = 6): Promise<Message[]>

// Append a message to a thread (called after every outbound reply)
export async function appendToThread(twitterUserId: string, username: string, msg: Message): Promise<void>
```

**Changes to `generateReply()` in `generate.ts`:**
- Accept `twitterUserId` and `twitterUsername` as optional params
- If provided, fetch thread history via `getThread()`
- Format as conversation history block before the current mention text
- After a reply is posted (in `telegram/route.ts`), call `appendToThread()` to record it

**Changes to mention handling in `telegram/route.ts`:**
- `approve_mention` and `reply_mention` callbacks: after posting, call `appendToThread()`
- `generateReply()` calls: pass `meta.authorId` and `meta.authorUsername`

**Impact:** Multiple simultaneous mention threads stay coherent. Claude knows if it already
apologised to someone, agreed with their point, or made a promise — and won't repeat itself.

---

### Phase 3 — Performance Feedback Loop

**What it does:** Weekly cron reads the activity log (likes, replies, engagements per content type),
identifies what performed, and writes insights back into `BrainMemory` under the `wins` key.
Future content generation automatically leans into what's working.

**New DB table:**
```prisma
model PerformanceInsight {
  id        String   @id @default(cuid())
  insight   String   // "Threads on AI tooling get 4× more engagement than founder mindset"
  metric    String?  // supporting stat
  createdAt DateTime @default(now())
}
```

**New file: `src/lib/brain/performance.ts`**
```typescript
// Reads Activity log from last 30 days
// Groups by content type, counts likes/replies/retweets via X API or stored metadata
// Feeds summary to Claude: "given these stats, what 3 content insights do you draw?"
// Stores result in PerformanceInsight and updates BrainMemory["wins"]
export async function analyzePerformance(): Promise<void>
```

**New cron job:** `src/app/api/cron/brain/route.ts` — runs Sunday at 11pm IST.
Added to `src/app/api/cron/dispatch/route.ts` weekly slot.

**New Telegram command: `/insights`**
```
/insights    — show current performance insights
```

---

### Phase 4 — Extended Thinking (Strategic Layer)

**What it does:** On-demand command that uses Claude Opus with extended thinking to reason about
account strategy, content direction, or any open question. Not used for routine generation
(too slow/expensive) — reserved for deliberate strategic decisions.

**New Telegram command: `/think [question]`**
```
/think                                          — weekly strategy briefing (what to focus on)
/think why is engagement dropping               — diagnose a specific issue
/think what should I post about this week       — content planning
/think should I pivot the Phantom positioning   — strategic question
```

**Implementation in `telegram/route.ts`:**
```typescript
// Uses anthropic.messages.create with:
//   model: "claude-opus-4-8"  (most capable, best for reasoning)
//   thinking: { type: "enabled", budget_tokens: 8000 }
// Passes full brain context + last 30 days activity summary + question
// Returns thinking summary + answer (not raw thinking tokens — just the conclusion)
```

---

## File Structure (new files)

```
src/lib/brain/
  context.ts       getBrainContext(), getThread(), appendToThread()
  performance.ts   analyzePerformance(), getInsights()
  index.ts         re-exports

src/app/api/cron/brain/
  route.ts         weekly performance analysis cron
```

## DB Changes (Prisma)

```prisma
model BrainMemory {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}

model ConversationThread {
  id              String   @id @default(cuid())
  twitterUserId   String   @unique
  twitterUsername String
  messages        Json
  updatedAt       DateTime @updatedAt
}

model PerformanceInsight {
  id        String   @id @default(cuid())
  insight   String
  metric    String?
  createdAt DateTime @default(now())
}
```

## Build Order

1. `prisma/schema.prisma` — add 3 new models
2. Run `prisma migrate dev` locally, commit generated client
3. `src/lib/brain/context.ts` — `getBrainContext()` + defaults + caching
4. `src/lib/claude/generate.ts` — inject brain context into all functions
5. `src/app/api/telegram/route.ts` — add `/context` command
6. Deploy + test: `/context`, `/tweet`, `/thread` — verify context appears in output
7. `src/lib/brain/context.ts` — add `getThread()` + `appendToThread()`
8. Update mention reply flow to use thread history
9. `src/lib/brain/performance.ts` + cron + `/insights` command
10. `/think` command with Opus extended thinking

## Pitfalls to Watch

- `getBrainContext()` must be cached (5 min TTL) — not a live DB hit per generation call
- Thread messages JSON must be capped (last 10 msgs max) — prevent token blowout
- Extended thinking (Phase 4) adds 3-10s latency — only on `/think`, never on auto-generation
- Prisma generated client must be committed after migration (same pattern as Waitlist fix)
- `ConversationThread` `twitterUserId @unique` — one record per user, append-only messages array
