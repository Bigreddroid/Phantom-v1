import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { isBlocked } from "@/lib/blocklist";
import { ensureWebhook } from "@/lib/telegram/setup";
import { NICHE_KEYWORDS } from "@/lib/config";

function getISTHour(): number {
  return parseInt(
    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }),
    10
  );
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Day mode (7am–10pm): like + reply
  // Night mode (10pm–7am): likes only — safe, quiet, still active
  const hour = getISTHour();
  const isDay = hour >= 7 && hour < 22;

  try {
    void ensureWebhook(); // fire-and-forget — re-registers if URL changed or missing

    const me = await getMyProfile();
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];

    // 10:1 verified:non-verified ratio
    const verifiedTweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 10);
    const normalTweets = await searchTweets(`${keyword} -is:retweet lang:en -is:verified`, 10);
    const tweets = [
      ...verifiedTweets,
      ...normalTweets.slice(0, Math.max(1, Math.floor(verifiedTweets.length / 10))),
    ];

    let liked = 0, replied = 0;
    const seen = new Set<string>();

    for (const tweet of tweets) {
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id)) continue;
      seen.add(tweet.author_id);

      // Always like — day or night
      try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
      await randomDelay(800, 2000);

      // Reply — 40% chance (day only)
      if (isDay && Math.random() < 0.4) {
        try {
          const reply = await generateReply(tweet.text, tweet.author_id);
          await replyToTweet(tweet.id, reply);
          replied++;
          await prisma.activity.create({
            data: { action: "Replied to tweet", detail: reply.slice(0, 80), icon: "💬" },
          });
          await sendMessage(
            `💬 *Comment posted on X*\n\n` +
            `_In reply to:_ "${tweet.text.slice(0, 100)}"\n\n` +
            `*Reply:* ${reply.slice(0, 200)}`
          );
          await randomDelay(2000, 5000);
        } catch { /* skip */ }
      }
    }

    await prisma.activity.create({
      data: {
        action: isDay ? "Engagement (day)" : "Engagement (night — likes only)",
        detail: `❤️ ${liked} · 💬 ${replied} · "${keyword}"`,
        icon: "⚡",
      },
    });

    if (liked > 0) {
      await notifyPosted(
        isDay ? "Engagement complete" : "Night engagement (likes only)",
        `❤️ ${liked} likes · 💬 ${replied} replies\n"${keyword}"`
      );
    }

    return NextResponse.json({ ok: true, liked, replied, keyword, mode: isDay ? "day" : "night" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
