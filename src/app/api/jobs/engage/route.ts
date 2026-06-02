import { NextResponse } from "next/server";
import { searchTweets, likeTweet, followUser, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyPosted } from "@/lib/telegram/notify";
import { randomDelay, shouldSkip } from "@/lib/scheduler/humanize";

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
    const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 10);

    let liked = 0, followed = 0, replied = 0, queued = 0;

    for (const tweet of tweets) {
      if (!tweet.author_id || tweet.author_id === me.id) continue;

      await likeTweet(tweet.id, me.id);
      liked++;
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
          await prisma.activity.create({ data: { action: "Replied to tweet", detail: reply.slice(0, 80), icon: "💬" } });
          await randomDelay(2000, 5000);
        } catch { /* skip */ }
      } else if (!shouldSkip(0.85)) {
        const reply = await generateReply(tweet.text, tweet.author_id);
        const item = await prisma.queueItem.create({
          data: { type: "Reply", content: reply, metadata: { tweetId: tweet.id, original: tweet.text.slice(0, 100) } },
        });
        await requestApproval("Reply to similar account", reply, { original: tweet.text.slice(0, 80), id: item.id });
        queued++;
      }
    }

    await prisma.activity.create({
      data: { action: `Liked ${liked} tweets`, detail: `Followed ${followed} · Replied ${replied} · Queued ${queued} · "${keyword}"`, icon: "❤️" },
    });

    await notifyPosted("Engagement run", `❤️ ${liked} · 👤 ${followed} follows · 💬 ${replied} replies · 📋 ${queued} queued`);

    return NextResponse.json({ ok: true, liked, followed, replied, queued, keyword });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
