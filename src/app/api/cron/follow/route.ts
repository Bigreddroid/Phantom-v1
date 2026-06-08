import { NextResponse } from "next/server";
import { searchTweets, followUser, likeTweet, getMyProfile } from "@/lib/x/engage";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";
import { getUserCtx, getStatsPaused } from "@/lib/user-context";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId") ?? null;
  const userCtx = await getUserCtx(userId).catch(() => null);
  if (userId && !userCtx) return NextResponse.json({ error: "User context unavailable" }, { status: 404 });

  const tg = userCtx?.telegram;
  const wOpts = userCtx ? { wClient: userCtx.scraperW } : undefined;
  const rOpts = userCtx ? { rClient: userCtx.scraperR, username: userCtx.username } : undefined;

  try {
    const paused = await getStatsPaused(userId);
    if (paused) return NextResponse.json({ skipped: true, reason: "paused" });

    const isBlocked = await loadBlocklist();
    const me = await getMyProfile(rOpts);
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userFilter = userId ? { userId } : { userId: null };
    const recentFollows = await prisma.activity.findMany({
      where: { ...userFilter, action: "Followed", createdAt: { gte: since24h } },
      select: { detail: true },
    });
    const recentlyFollowed = new Set(recentFollows.map((a) => a.detail ?? ""));

    const verifiedTweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 15);
    const tweets = verifiedTweets;

    const MAX_FOLLOWS = 3;
    let followed = 0, liked = 0, replied = 0;
    const seen = new Set<string>();

    for (const tweet of tweets) {
      if (followed >= MAX_FOLLOWS) break;
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id, tweet.author_username)) continue;
      if (recentlyFollowed.has(tweet.author_username ?? tweet.author_id)) continue;
      seen.add(tweet.author_id);

      const username = tweet.author_username ?? tweet.author_id;
      try {
        await followUser(username, me.id, wOpts);
        followed++;
        await prisma.activity.create({
          data: { userId: userId ?? null, action: "Followed", detail: username, icon: "👤" },
        });
      } catch { /* already following or rate limited */ }
      await randomDelay(600, 1200);

      try { await likeTweet(tweet.id, me.id, wOpts); liked++; } catch { /* skip */ }
      await randomDelay(400, 800);
    }

    await prisma.activity.create({
      data: {
        userId: userId ?? null,
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
      `_Topic: "${keyword}"_`,
      tg
    );

    return NextResponse.json({ ok: true, followed, liked, replied, keyword });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
