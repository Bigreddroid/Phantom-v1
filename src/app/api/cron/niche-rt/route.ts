import { NextResponse } from "next/server";
import { searchTweets } from "@/lib/x/engage";
import { prisma } from "@/lib/db";
import { notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (shouldSkip(0.3)) return NextResponse.json({ skipped: true, reason: "random skip" });

  await humanPause();

  try {
    const isBlocked = await loadBlocklist();
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];

    const tweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 20);

    // Score by traction: likes + retweets×4 + quotes×3 + replies×1
    const scored = tweets
      .filter(t => t.author_id && !isBlocked(t.author_id, t.author_username))
      .map(t => ({
        ...t,
        score: (t.public_metrics?.like_count ?? 0)
          + (t.public_metrics?.retweet_count ?? 0) * 4
          + (t.public_metrics?.quote_count ?? 0) * 3
          + (t.public_metrics?.reply_count ?? 0),
      }))
      .filter(t => t.score >= 20)              // minimum traction gate
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      return NextResponse.json({ skipped: true, reason: "no high-traction candidates" });
    }

    // Pick randomly from top 3 so it's not always the same viral post
    const tweet = scored[Math.floor(Math.random() * Math.min(scored.length, 3))];
    const stats = `❤️ ${tweet.public_metrics?.like_count ?? 0} · 🔁 ${tweet.public_metrics?.retweet_count ?? 0}`;

    const item = await prisma.queueItem.create({
      data: {
        type: "NicheRT",
        content: tweet.text,
        metadata: { tweetId: tweet.id, authorUsername: tweet.author_username, keyword, cron: true },
      },
    });

    await fetch(`${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text:
          `*🔁 Repost this niche tweet?*\n\n` +
          `@${tweet.author_username}: _"${tweet.text.slice(0, 300)}"_\n\n` +
          `🎯 Topic: "${keyword}" · ${stats}\n_ID: \`${item.id}\`_`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🔁 Retweet",    callback_data: `niche_rt:${item.id}` },
            { text: "💬 Quote-tweet", callback_data: `niche_quote:${item.id}` },
            { text: "❌ Skip",        callback_data: `reject:${item.id}` },
          ]],
        },
      }),
    });

    return NextResponse.json({ ok: true, queued: true, id: item.id, keyword });
  } catch (e) {
    await notifyError("Niche RT cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
