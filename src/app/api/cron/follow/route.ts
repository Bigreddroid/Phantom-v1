import { NextResponse } from "next/server";
import { searchTweets, followUser, likeTweet, getMyProfile } from "@/lib/x/engage";
import { generateReply } from "@/lib/claude/generate";
import { replyToTweet } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";
import { getRepliedTweetIds, buildReplyDetail } from "@/lib/reply-dedup";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
    if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];
    const repliedTweetIds = await getRepliedTweetIds();

    // Load accounts followed in the last 24h to avoid re-following
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFollows = await prisma.activity.findMany({
      where: { action: "Followed", createdAt: { gte: since24h } },
      select: { detail: true },
    });
    const recentlyFollowed = new Set(recentFollows.map((a) => a.detail ?? ""));

    // Only verified — reduces automation signal vs scraping normal accounts
    const verifiedTweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 15);
    const tweets = verifiedTweets;

    // Hard cap: max 3 follows per cron run to stay well under X's limits
    const MAX_FOLLOWS = 3;
    let followed = 0, liked = 0, replied = 0;
    const seen = new Set<string>();

    for (const tweet of tweets) {
      if (followed >= MAX_FOLLOWS) break;
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id, tweet.author_username)) continue;
      if (recentlyFollowed.has(tweet.author_username ?? tweet.author_id)) continue;
      seen.add(tweet.author_id);

      try {
        await followUser(tweet.author_id, me.id);
        followed++;
        // Record follow with username for 24h dedup
        await prisma.activity.create({
          data: { action: "Followed", detail: tweet.author_username ?? tweet.author_id, icon: "👤" },
        });
      } catch { /* already following or rate limited */ }
      // 8-18s human-paced delay between follows
      await randomDelay(8000, 18000);

      try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
      await randomDelay(3000, 7000);

      // Reply to ~30% of followed accounts — skip if already replied to this tweet
      if (Math.random() < 0.3 && !repliedTweetIds.has(tweet.id)) {
        try {
          const reply = await generateReply(tweet.text, tweet.author_username || tweet.author_id);
          await replyToTweet(tweet.id, reply);
          replied++;
          await prisma.activity.create({
            data: { action: "Replied to tweet", detail: buildReplyDetail(tweet.id, tweet.author_id ?? "", reply), icon: "💬" },
          });
          await sendMessage(
            `💬 *Commented on new follow*\n\n` +
            `_Their tweet:_ "${tweet.text.slice(0, 100)}"\n\n` +
            `*Reply:* ${reply.slice(0, 200)}`
          );
          await randomDelay(5000, 12000);
        } catch { /* skip */ }
      }
    }

    await prisma.activity.create({
      data: {
        action: `Follow run`,
        detail: `👤 ${followed} followed · ❤️ ${liked} liked · 💬 ${replied} replied · "${keyword}"`,
        icon: "🤝",
      },
    });

    await sendMessage(
      `🤝 *Follow run complete*\n\n` +
      `👤 Followed: *${followed}*\n` +
      `❤️ Liked: *${liked}*\n` +
      `💬 Replied: *${replied}*\n` +
      `_Topic: "${keyword}"_`
    );

    return NextResponse.json({ ok: true, followed, liked, replied, keyword });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
