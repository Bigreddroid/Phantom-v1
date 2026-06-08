export const maxDuration = 60;
import { NextResponse } from "next/server";
import { DEMO } from "@/lib/demo-data";
import { searchTweets, followUser, likeTweet, getMyProfile } from "@/lib/x/engage";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

export async function POST(req: Request) {
  if (DEMO) return NextResponse.json({ ok: true, demo: true, skipped: "demo mode" });
  const body = await req.json().catch(() => ({}));
  // Hard cap at 5 for manual — still human-paced
  const count = Math.min(Number(body.count) || 3, 5);

  try {
    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFollows = await prisma.activity.findMany({
      where: { action: "Followed", createdAt: { gte: since24h } },
      select: { detail: true },
    });
    const recentlyFollowed = new Set(recentFollows.map((a) => a.detail ?? ""));

    let followed = 0, liked = 0;
    const seen = new Set<string>();

    // Pick one keyword per run — looping all keywords across follows blows the 60s limit
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];
    const verifiedTweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 15);

    for (const tweet of verifiedTweets) {
      if (followed >= count) break;
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id, tweet.author_username)) continue;
      if (recentlyFollowed.has(tweet.author_username ?? tweet.author_id)) continue;
      seen.add(tweet.author_id);

      const username = tweet.author_username ?? tweet.author_id;
      try {
        await followUser(username, me.id);
        followed++;
        await prisma.activity.create({
          data: { action: "Followed", detail: username, icon: "👤" },
        });
      } catch { /* already following */ }
      await randomDelay(600, 1200);

      try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
      await randomDelay(400, 800);
    }

    await sendMessage(`🤝 *Follow run*\n\n👤 ${followed} followed · ❤️ ${liked} liked\n_Topic: "${keyword}"_`);
    await prisma.activity.create({
      data: { action: "Follow run (manual)", detail: `👤 ${followed} · ❤️ ${liked} · "${keyword}"`, icon: "🤝" },
    });

    return NextResponse.json({ ok: true, followed, liked });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
