import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

export async function POST() {
  try {
    const isBlocked = await loadBlocklist();
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
    const comments: Array<{ original: string; reply: string }> = [];
    const errors: string[] = [];

    for (const tweet of tweets) {
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id, tweet.author_username)) continue;
      seen.add(tweet.author_id);

      try { await likeTweet(tweet.id, me.id); liked++; } catch (e) {
        errors.push(`like ${tweet.id}: ${String(e).slice(0, 60)}`);
      }
      await randomDelay(800, 2000);

      // Reply — 40% chance
      if (Math.random() < 0.4) {
        try {
          const reply = await generateReply(tweet.text, tweet.author_username || tweet.author_id || "someone");
          await replyToTweet(tweet.id, reply);
          replied++;
          comments.push({ original: tweet.text.slice(0, 100), reply });
          await prisma.activity.create({
            data: { action: "Replied to tweet", detail: reply.slice(0, 80), icon: "💬" },
          });
          await sendMessage(
            `💬 *Comment posted on X*\n\n` +
            `_In reply to:_ "${tweet.text.slice(0, 100)}"\n\n` +
            `*Reply:* ${reply.slice(0, 200)}`
          );
          await randomDelay(2000, 5000);
        } catch (e) {
          errors.push(`reply ${tweet.id}: ${String(e).slice(0, 60)}`);
        }
      }
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
