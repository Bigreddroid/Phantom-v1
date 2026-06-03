import { NextResponse } from "next/server";
import { getMyProfile, getMyTweets } from "@/lib/x/engage";
import { prisma } from "@/lib/db";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendApproval(text: string, itemId: string) {
  await fetch(`${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "💬 Quote-tweet it", callback_data: `resurface:${itemId}` },
          { text: "❌ Skip",           callback_data: `reject:${itemId}` },
        ]],
      },
    }),
  });
}

export async function POST() {
  try {
    const me = await getMyProfile();
    const tweets = await getMyTweets(me.id, 50);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldTweets = tweets.filter(
      t => t.created_at && new Date(t.created_at) < sevenDaysAgo
    );

    if (!oldTweets.length) {
      return NextResponse.json({ ok: false, reason: "No tweets older than 7 days found" });
    }

    // Skip tweets already resurface-queued in the last 30 days
    const recentlySurfaced = await prisma.queueItem.findMany({
      where: {
        type: "Resurface",
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        status: { not: "REJECTED" },
      },
      select: { metadata: true },
    });
    const surfacedIds = new Set(
      recentlySurfaced.map(r => (r.metadata as Record<string, string> | null)?.tweetId).filter(Boolean) as string[]
    );
    const freshTweets = oldTweets.filter(t => !surfacedIds.has(t.id));
    if (!freshTweets.length) {
      return NextResponse.json({ ok: false, reason: "All old tweets already resurfaced recently" });
    }

    const tweet = freshTweets[Math.floor(Math.random() * freshTweets.length)];

    const item = await prisma.queueItem.create({
      data: {
        type: "Resurface",
        content: tweet.text,
        metadata: { tweetId: tweet.id, postedAt: tweet.created_at ?? "" },
      },
    });

    await sendApproval(
      `*🔁 Resurface old tweet?*\n\n\`\`\`\n${tweet.text.slice(0, 400)}\n\`\`\`\n\n_ID: \`${item.id}\`_`,
      item.id
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
