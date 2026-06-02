import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyPosted } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";

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
    const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 8);

    let liked = 0;
    let queued = 0;

    for (const tweet of tweets) {
      if (!tweet.author_id || tweet.author_id === me.id) continue;

      // Always like
      await likeTweet(tweet.id, me.id);
      liked++;
      await randomDelay(800, 2500);

      // 30% chance to also queue a reply for approval
      if (Math.random() < 0.3) {
        const reply = await generateReply(tweet.text, tweet.author_id);
        const item = await prisma.queueItem.create({
          data: {
            type: "Reply",
            content: reply,
            metadata: { tweetId: tweet.id, original: tweet.text.slice(0, 100), source: "engage" },
          },
        });
        await requestApproval("Reply to similar account", reply, {
          original: tweet.text.slice(0, 80),
          keyword,
          id: item.id,
        });
        queued++;
      }
    }

    await prisma.activity.create({
      data: {
        action: `Liked ${liked} tweets`,
        detail: `Topic: "${keyword}" · ${queued} replies queued`,
        icon: "❤️",
      },
    });

    if (queued > 0) {
      await notifyPosted("Engagement run", `Liked ${liked} tweets about "${keyword}" · ${queued} replies queued for approval`);
    }

    return NextResponse.json({ ok: true, liked, queued, keyword });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
