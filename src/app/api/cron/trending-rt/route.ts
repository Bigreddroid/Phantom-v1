import { NextResponse } from "next/server";
import { searchTweets } from "@/lib/x/engage";
import { quoteTweet } from "@/lib/x/post";
import { generateQuoteTweet } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { humanPause, shouldSkip } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { getUserCtx, getStatsPaused } from "@/lib/user-context";

export const maxDuration = 55;

// High-signal trending searches across tech/AI/web3/automation verticals
const TRENDING_QUERIES = [
  // AI / LLM
  "AI agent LLM min_faves:200 -is:retweet lang:en",
  "Claude GPT Gemini min_faves:300 -is:retweet lang:en",
  "artificial intelligence automation min_faves:200 -is:retweet lang:en",
  "LLM tool use model context protocol min_faves:150 -is:retweet lang:en",
  // Tech / startup
  "build in public SaaS founder min_faves:150 -is:retweet lang:en",
  "solopreneur indie hacker shipped min_faves:100 -is:retweet lang:en",
  "software engineering developer tools min_faves:200 -is:retweet lang:en",
  // Web3 / crypto (user explicitly requested)
  "web3 DeFi protocol launched min_faves:300 -is:retweet lang:en",
  "blockchain AI agent onchain min_faves:200 -is:retweet lang:en",
  "crypto market trend analysis min_faves:400 -is:retweet lang:en",
  // Automation / no-code
  "automation workflow no-code min_faves:100 -is:retweet lang:en",
  "n8n zapier make workflow ai min_faves:100 -is:retweet lang:en",
];

// Off-topic guard — never quote political/breaking news
const OFFTOPIC = [
  "trump", "biden", "harris", "obama", "pelosi", "congress", "senate",
  "republican", "democrat", "maga", "election", "ballot",
  "shooting", "arrested", "lawsuit", "court", "verdict",
  "breaking:", "just in:", "breaking news", "nfl", "nba", "fifa",
];

function isAllowed(text: string): boolean {
  const lower = text.toLowerCase();
  return !OFFTOPIC.some(s => lower.includes(s));
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId") ?? null;
  const userCtx = await getUserCtx(userId).catch(() => null);
  if (userId && !userCtx) return NextResponse.json({ error: "User context unavailable" }, { status: 404 });

  const tg = userCtx?.telegram;

  const paused = await getStatsPaused(userId);
  if (paused) return NextResponse.json({ skipped: true, reason: "paused" });

  // Run ~60% of the time to avoid over-posting
  if (shouldSkip(0.4)) return NextResponse.json({ skipped: true, reason: "random skip" });

  await humanPause();

  try {
    const isBlocked = await loadBlocklist();

    // Pick a random trending query
    const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
    const tweets = await searchTweets(query, 20);

    const userFilter = userId ? { userId } : { userId: null };

    // Load tweets quoted in the last 48h to avoid repeating the same viral post
    const recentQuotes = await prisma.activity.findMany({
      where: { ...userFilter, action: "Trending quote-tweet", createdAt: { gte: new Date(Date.now() - 48 * 3600000) } },
      select: { detail: true },
    });
    const recentIds = new Set(
      recentQuotes.map(a => a.detail?.match(/^tid:(\w+)/)?.[1]).filter(Boolean) as string[]
    );

    // Score by traction
    const candidates = tweets
      .filter(t =>
        t.id &&
        t.author_id &&
        !isBlocked(t.author_id, t.author_username) &&
        isAllowed(t.text) &&
        !recentIds.has(t.id) &&
        t.text.trim().length > 30
      )
      .map(t => ({
        ...t,
        score: (t.public_metrics?.like_count ?? 0)
          + (t.public_metrics?.retweet_count ?? 0) * 4
          + (t.public_metrics?.quote_count ?? 0) * 3,
      }))
      .filter(t => t.score >= 50)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) {
      return NextResponse.json({ skipped: true, reason: "no high-traction candidates" });
    }

    // Pick from top 5 so it's not always the same post
    const tweet = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];

    // Generate a value-add comment (not just "great post")
    const comment = await generateQuoteTweet(tweet.text);

    // Auto-post — no approval needed
    await quoteTweet(tweet.id, comment);

    await prisma.activity.create({
      data: {
        userId: userId ?? null,
        action: "Trending quote-tweet",
        detail: `tid:${tweet.id}|@${tweet.author_username}: ${comment.slice(0, 80)}`,
        icon: "💬",
      },
    });

    await sendMessage(
      `💬 *Auto-quoted trending post*\n\n` +
      `@${tweet.author_username}: _"${tweet.text.slice(0, 200)}"_\n\n` +
      `*Our quote:* ${comment}`,
      tg
    );

    return NextResponse.json({ ok: true, quoted: true, tweetId: tweet.id, comment });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
