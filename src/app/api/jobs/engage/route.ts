import { NextResponse } from "next/server";
import { searchTweets, likeTweet, followUser, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { randomDelay, shouldSkip } from "@/lib/scheduler/humanize";
import { isBlocked } from "@/lib/blocklist";

const KEYWORDS = [
  "founder personal brand",
  "building in public",
  "solopreneur automation",
  "AI tools for creators",
  "indiehacker",
  "personal brand tips",
  "content creator tools",
];

export async function POST() {
  try {
    const me = await getMyProfile();
    const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

    // 10:1 verified:non-verified ratio
    const verifiedTweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 10);
    const normalTweets = await searchTweets(`${keyword} -is:retweet lang:en -is:verified`, 10);
    const tweets = [
      ...verifiedTweets,
      ...normalTweets.slice(0, Math.max(1, Math.floor(verifiedTweets.length / 10))),
    ];

    let liked = 0, followed = 0, replied = 0;
    const seen = new Set<string>();

    for (const tweet of tweets) {
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id)) continue;
      seen.add(tweet.author_id);

      try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
      await randomDelay(800, 2000);

      if (!shouldSkip(0.8)) {
        try { await followUser(tweet.author_id, me.id); followed++; } catch { /* skip */ }
        await randomDelay(500, 1500);
      }

      if (!shouldSkip(0.75)) {
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
        action: `Engagement run (10:1 ratio)`,
        detail: `❤️ ${liked} · 👤 ${followed} · 💬 ${replied} · "${keyword}"`,
        icon: "⚡",
      },
    });

    await notifyPosted(
      "Engagement complete",
      `❤️ ${liked} likes · 👤 ${followed} follows · 💬 ${replied} replies\nTopic: "${keyword}"`
    );

    return NextResponse.json({ ok: true, liked, followed, replied, keyword });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
