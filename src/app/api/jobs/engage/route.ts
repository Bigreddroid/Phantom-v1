import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();
    const keyword = (body.keyword as string | undefined)?.trim()
      || NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];

    // Load 24h dedup memory — tweet IDs already replied to
    const recentReplies = await prisma.activity.findMany({
      where: { action: "Replied to tweet", createdAt: { gte: new Date(Date.now() - 86400000) } },
      select: { detail: true },
      take: 200,
    });
    const repliedIds = new Set(
      recentReplies.map(a => a.detail?.match(/^tid:(\w+)/)?.[1]).filter(Boolean) as string[]
    );

    // 10:1 verified:non-verified ratio, cap at 6 total to stay under function timeout
    const [verifiedTweets, normalTweets] = await Promise.all([
      searchTweets(`${keyword} -is:retweet lang:en is:verified`, 10),
      searchTweets(`${keyword} -is:retweet lang:en -is:verified`, 10),
    ]);

    const candidates = [
      ...verifiedTweets,
      ...normalTweets.slice(0, Math.max(1, Math.floor(verifiedTweets.length / 10))),
    ];

    // Deduplicate authors and filter blocked/self/already-replied, then rank by traction
    const seen = new Set<string>();
    const tweets = candidates
      .filter(t => {
        if (!t.author_id || t.author_id === me.id) return false;
        if (seen.has(t.author_id)) return false;
        if (isBlocked(t.author_id, t.author_username)) return false;
        if (repliedIds.has(t.id)) return false;
        seen.add(t.author_id);
        return true;
      })
      .map(t => ({
        ...t,
        score: (t.public_metrics?.like_count ?? 0)
          + (t.public_metrics?.retweet_count ?? 0) * 3
          + (t.public_metrics?.reply_count ?? 0),
      }))
      .filter(t => t.score >= 5)             // only engage with posts that have some traction
      .sort((a, b) => b.score - a.score)
      .slice(0, 6); // hard cap — keeps total runtime well under 60s

    // ── Phase 1: like all tweets quickly ────────────────────────────────────
    let liked = 0;
    const errors: string[] = [];

    for (const tweet of tweets) {
      try { await likeTweet(tweet.id, me.id); liked++; } catch (e) {
        errors.push(`like: ${String(e).slice(0, 60)}`);
      }
      await randomDelay(400, 800); // short — likes are low-risk
    }

    // ── Phase 2: pick reply targets + generate all in parallel ──────────────
    const replyTargets = tweets.filter(() => Math.random() < 0.7); // higher rate

    const generatedReplies = await Promise.all(
      replyTargets.map(t =>
        generateReply(t.text, t.author_username || t.author_id || "someone").catch(() => null)
      )
    );

    // ── Phase 3: post replies sequentially ──────────────────────────────────
    let replied = 0;
    const comments: Array<{ original: string; reply: string }> = [];

    for (let i = 0; i < replyTargets.length; i++) {
      const reply = generatedReplies[i];
      if (!reply) continue;
      const tweet = replyTargets[i];

      try {
        await replyToTweet(tweet.id, reply);
        replied++;
        comments.push({ original: tweet.text.slice(0, 100), reply });
        await prisma.activity.create({
          data: { action: "Replied to tweet", detail: `tid:${tweet.id}|${reply.slice(0, 70)}`, icon: "💬" },
        });
        await sendMessage(
          `💬 *Comment posted on X*\n\n` +
          `_In reply to:_ "${tweet.text.slice(0, 100)}"\n\n` +
          `*Reply:* ${reply.slice(0, 200)}`
        );
        await randomDelay(800, 1500);
      } catch (e) {
        const msg = String(e);
        const hint = msg.includes("403") ? " (check OAuth write permissions)" : msg.includes("429") ? " (rate limit)" : "";
        errors.push(`reply: ${msg.slice(0, 60)}${hint}`);
        await prisma.activity.create({
          data: { action: "Reply failed", detail: msg.slice(0, 80), icon: "❌" },
        });
      }
    }

    if (errors.length > 0) {
      await sendMessage(`⚠️ *Engage: ${errors.length} error(s)*\n\`${errors[0]}\``);
    }

    await prisma.activity.create({
      data: {
        action: "Engagement run",
        detail: `❤️ ${liked} · 💬 ${replied} · "${keyword}"`,
        icon: "⚡",
      },
    });

    await notifyPosted(
      "Engagement complete",
      `❤️ ${liked} likes · 💬 ${replied} replies\nTopic: "${keyword}"`
    );

    return NextResponse.json({ ok: true, liked, replied, keyword, comments, errors });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
