import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateGoOutComment } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyError, sendMessage } from "@/lib/telegram/notify";
import { shouldSkip, isActiveHour, randomDelay, humanPause } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

export const maxDuration = 60;

const GOOUT_KEYWORDS = [
  // High-volume threads where a reply gets visibility
  "building in public",
  "shipped today",
  "just launched my",
  "what I'm building",
  "indie maker",
  "solo founder",
  // Topic hooks that attract active builders
  "AI tools for founders",
  "solopreneur workflow",
  "personal brand strategy",
  "automate your content",
  "founder content strategy",
  "build an audience",
  // Genuine conversation starters
  "what are you building",
  "honest about building",
  "the mistake founders make",
];

// Parse dedup detail: "tid:<tweetId>|aid:<authorId>|<text>"
function parseDedupDetail(detail: string | null | undefined) {
  if (!detail?.startsWith("tid:")) return null;
  const tweetId  = detail.match(/^tid:(\w+)/)?.[1];
  const authorId = detail.match(/\|aid:(\w+)/)?.[1];
  return { tweetId, authorId };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (!isActiveHour() || shouldSkip(0.3)) return NextResponse.json({ skipped: true });

  await humanPause();

  try {
    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();

    // ── Load 7-day dedup memory (tweet IDs + author IDs already commented on) ──
    const recentComments = await prisma.activity.findMany({
      where: {
        icon: "🗣️",
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      select: { detail: true },
      take: 500,
    });

    const seenTweetIds  = new Set<string>();
    const seenAuthorIds = new Set<string>();
    for (const a of recentComments) {
      const parsed = parseDedupDetail(a.detail);
      if (parsed?.tweetId)  seenTweetIds.add(parsed.tweetId);
      if (parsed?.authorId) seenAuthorIds.add(parsed.authorId);
    }

    // ── Pick 2 different keywords this run for variety ─────────────────────────
    const allKeywords = [...GOOUT_KEYWORDS, ...NICHE_KEYWORDS.slice(0, 5)];
    const shuffled = allKeywords.sort(() => Math.random() - 0.5);
    const keywords  = shuffled.slice(0, 2);

    // ── Fetch candidates from both keywords in parallel ────────────────────────
    const [batch1, batch2] = await Promise.all(
      keywords.map(kw => searchTweets(`${kw} -is:retweet lang:en`, 20))
    );

    const allTweets = [...batch1, ...batch2];

    // ── Deduplicate tweet IDs from both batches ────────────────────────────────
    const seenInBatch = new Set<string>();
    const unique = allTweets.filter(t => {
      if (seenInBatch.has(t.id)) return false;
      seenInBatch.add(t.id);
      return true;
    });

    // ── Score, filter, and sort ────────────────────────────────────────────────
    const scored = unique
      .filter(t =>
        t.author_id &&
        t.author_id !== me.id &&
        !isBlocked(t.author_id, t.author_username) &&
        !seenTweetIds.has(t.id) &&
        !seenAuthorIds.has(t.author_id)
      )
      .map(t => ({
        ...t,
        score: (t.public_metrics?.like_count ?? 0)
          + (t.public_metrics?.retweet_count ?? 0) * 4
          + (t.public_metrics?.reply_count ?? 0) * 2,
      }))
      .sort((a, b) => b.score - a.score);

    // Primary tier ≥10, fallback tier ≥5 (fewer slots) when nothing passes the bar
    let targets = scored.filter(t => t.score >= 10).slice(0, 3);
    if (!targets.length) targets = scored.filter(t => t.score >= 5).slice(0, 2);

    if (!targets.length) {
      return NextResponse.json({ skipped: true, reason: "no unseen high-traction targets" });
    }

    const comments: Array<{ original: string; reply: string }> = [];
    const errors: string[] = [];

    for (const tweet of targets) {
      try {
        await likeTweet(tweet.id, me.id);
        await randomDelay(800, 2000);

        const reply = await generateGoOutComment(tweet.text);
        await replyToTweet(tweet.id, reply);
        comments.push({ original: tweet.text.slice(0, 100), reply });

        // Store with dedup prefix so future runs can skip this tweet + author
        await prisma.activity.create({
          data: {
            action: "Auto comment dropped",
            detail: `tid:${tweet.id}|aid:${tweet.author_id}|${reply.slice(0, 60)}`,
            icon: "🗣️",
          },
        });

        await sendMessage(
          `🗣️ *Auto-comment posted*\n\n` +
          `_"${tweet.text.slice(0, 120)}"_\n\n` +
          `↩ ${reply}\n\n` +
          `❤️ ${tweet.public_metrics?.like_count ?? 0} · 🔁 ${tweet.public_metrics?.retweet_count ?? 0}`
        );

        await randomDelay(3000, 6000);
      } catch (e) {
        errors.push(String(e).slice(0, 80));
      }
    }

    await prisma.activity.create({
      data: {
        action: "Auto go-out run",
        detail: `🗣️ ${comments.length} comments · ${keywords.join(", ").slice(0, 60)}`,
        icon: "🗣️",
      },
    });

    return NextResponse.json({ ok: true, comments: comments.length, keywords, errors });
  } catch (e) {
    await notifyError("Auto goout cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
