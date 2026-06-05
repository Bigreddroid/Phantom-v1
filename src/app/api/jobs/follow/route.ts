export const maxDuration = 60;
import { NextResponse } from "next/server";
import { DEMO } from "@/lib/demo-data";
import { searchTweets, followUser, likeTweet, getMyProfile } from "@/lib/x/engage";
import { generateReply } from "@/lib/claude/generate";
import { replyToTweet } from "@/lib/x/post";
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

    let followed = 0, liked = 0, replied = 0;
    const seen = new Set<string>();

    for (const keyword of NICHE_KEYWORDS) {
      if (followed >= count) break;

      const verifiedTweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 10);

      for (const tweet of verifiedTweets) {
        if (followed >= count) break;
        if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id, tweet.author_username)) continue;
        if (recentlyFollowed.has(tweet.author_username ?? tweet.author_id)) continue;
        seen.add(tweet.author_id);

        try {
          await followUser(tweet.author_id, me.id);
          followed++;
          await prisma.activity.create({
            data: { action: "Followed", detail: tweet.author_username ?? tweet.author_id, icon: "👤" },
          });
        } catch { /* already following */ }
        await randomDelay(8000, 18000);

        try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
        await randomDelay(3000, 7000);

        if (Math.random() < 0.3) {
          try {
            const reply = await generateReply(tweet.text, tweet.author_username || tweet.author_id || "someone");
            await replyToTweet(tweet.id, reply);
            replied++;
            await prisma.activity.create({
              data: { action: "Replied to new follow", detail: reply.slice(0, 250), icon: "💬" },
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
    }

    await prisma.activity.create({
      data: {
        action: `Follow run (manual)`,
        detail: `👤 ${followed} · ❤️ ${liked} · 💬 ${replied}`,
        icon: "🤝",
      },
    });

    return NextResponse.json({ ok: true, followed, liked, replied });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
