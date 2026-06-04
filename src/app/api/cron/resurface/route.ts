import { NextResponse } from "next/server";
import { getMyProfile, getMyTweets } from "@/lib/x/engage";
import { prisma } from "@/lib/db";
import { notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (shouldSkip(0.2)) return NextResponse.json({ skipped: true, reason: "random skip" });

  await humanPause();

  try {
    const me = await getMyProfile();
    const tweets = await getMyTweets(me.id, 50);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Rank by engagement — resurface tweets that actually got traction
    const ranked = tweets
      .filter(t => t.created_at && new Date(t.created_at) < sevenDaysAgo)
      .map(t => ({
        ...t,
        score: (t.public_metrics?.like_count ?? 0)
          + (t.public_metrics?.retweet_count ?? 0) * 5
          + (t.public_metrics?.reply_count ?? 0) * 2
          + (t.public_metrics?.quote_count ?? 0) * 3,
      }))
      .filter(t => t.score >= 5)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) {
      return NextResponse.json({ skipped: true, reason: "no old tweets with engagement found" });
    }

    // Vary picks — top 5 so it's not always the same tweet
    const tweet = ranked[Math.floor(Math.random() * Math.min(ranked.length, 5))];
    const stats = `❤️ ${tweet.public_metrics?.like_count ?? 0} · 🔁 ${tweet.public_metrics?.retweet_count ?? 0}`;

    const item = await prisma.queueItem.create({
      data: {
        type: "Resurface",
        content: tweet.text,
        metadata: { tweetId: tweet.id, postedAt: tweet.created_at ?? "", cron: true },
      },
    });

    await fetch(`${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `*🔁 Resurface old tweet?*\n\n\`\`\`\n${tweet.text.slice(0, 400)}\n\`\`\`\n\n${stats}\n_ID: \`${item.id}\`_`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "💬 Quote-tweet it", callback_data: `resurface:${item.id}` },
            { text: "❌ Skip",           callback_data: `reject:${item.id}` },
          ]],
        },
      }),
    });

    return NextResponse.json({ ok: true, queued: true, id: item.id });
  } catch (e) {
    await notifyError("Resurface cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
