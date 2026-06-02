import { NextResponse } from "next/server";
import { searchTweets, likeTweet, followUser, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyPosted } from "@/lib/telegram/notify";
import { isActiveHour, randomDelay, shouldSkip } from "@/lib/scheduler/humanize";

const KEYWORDS = [
  "founder personal brand",
  "building in public",
  "solopreneur automation",
  "AI tools for creators",
  "indiehacker",
  "personal brand tips",
  "content creator tools",
  "indie founder",
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isActiveHour()) {
    return NextResponse.json({ skipped: true, reason: "outside active hours" });
  }

  const me = await getMyProfile();
  const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
  const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 8);

  let liked = 0;
  let followed = 0;
  let replied = 0;
  let queued = 0;

  for (const tweet of tweets) {
    if (!tweet.author_id || tweet.author_id === me.id) continue;

    // Always like
    await likeTweet(tweet.id, me.id);
    liked++;
    await randomDelay(800, 2000);

    // 20% chance to follow the author
    if (!shouldSkip(0.8)) {
      try {
        await followUser(tweet.author_id, me.id);
        followed++;
        await randomDelay(500, 1500);
      } catch { /* already following */ }
    }

    // 25% chance to reply automatically (low-stakes replies go straight to X)
    if (!shouldSkip(0.75)) {
      try {
        const reply = await generateReply(tweet.text, tweet.author_id);

        // Auto-post reply directly
        await replyToTweet(tweet.id, reply);
        replied++;

        await prisma.activity.create({
          data: {
            action: "Replied to tweet",
            detail: reply.slice(0, 80),
            icon: "💬",
          },
        });

        await randomDelay(2000, 5000);
      } catch { /* skip on error */ }
    }
    // Another 15% chance — queue for approval instead
    else if (!shouldSkip(0.85)) {
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
      detail: `Followed ${followed} · Replied ${replied} · Queued ${queued} · Topic: "${keyword}"`,
      icon: "❤️",
    },
  });

  if (followed > 0 || replied > 0) {
    await notifyPosted(
      "Engagement run",
      `❤️ ${liked} likes · 👤 ${followed} follows · 💬 ${replied} replies · 📋 ${queued} queued\nTopic: "${keyword}"`
    );
  }

  return NextResponse.json({ ok: true, liked, followed, replied, queued, keyword });
}
