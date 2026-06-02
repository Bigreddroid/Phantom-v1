import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateGoOutComment } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

export async function POST() {
  try {
    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];
    const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 10);

    const comments: Array<{ original: string; reply: string }> = [];
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const tweet of tweets.slice(0, 5)) {
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id, tweet.author_username)) continue;
      seen.add(tweet.author_id);

      try {
        await likeTweet(tweet.id, me.id);
        await randomDelay(600, 1800);

        const reply = await generateGoOutComment(tweet.text);
        await replyToTweet(tweet.id, reply);
        comments.push({ original: tweet.text.slice(0, 100), reply });

        await prisma.activity.create({
          data: { action: "Go-out comment", detail: reply.slice(0, 80), icon: "🗣️" },
        });
        await sendMessage(
          `🗣️ *Dropped a comment*\n\n` +
          `_"${tweet.text.slice(0, 100)}"_\n\n` +
          `↩ ${reply}`
        );
        await randomDelay(2000, 4000);
      } catch (e) {
        errors.push(`tweet ${tweet.id}: ${String(e).slice(0, 80)}`);
      }
    }

    await prisma.activity.create({
      data: { action: "Go-out run", detail: `🗣️ ${comments.length} comments · "${keyword}"`, icon: "🗣️" },
    });

    return NextResponse.json({ ok: true, comments, keyword, errors });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
