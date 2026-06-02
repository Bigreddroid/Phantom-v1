import { NextResponse } from "next/server";
import { searchTweets, followUser, likeTweet, getMyProfile } from "@/lib/x/engage";
import { generateReply } from "@/lib/claude/generate";
import { replyToTweet } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { isBlocked } from "@/lib/blocklist";

const KEYWORDS = [
  "founder personal brand",
  "building in public",
  "solopreneur automation",
  "AI tools for creators",
  "indiehacker",
  "personal brand tips",
  "indie founder growth",
  "content creator tools",
  "creator economy",
  "startup founder",
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    let followed = 0, liked = 0, replied = 0;
    const seen = new Set<string>();

    for (const tweet of tweets) {
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id)) continue;
      seen.add(tweet.author_id);

      try { await followUser(tweet.author_id, me.id); followed++; } catch { /* already following */ }
      await randomDelay(1000, 2500);

      try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
      await randomDelay(500, 1500);

      // Reply to ~40% of followed accounts
      if (Math.random() < 0.4) {
        try {
          const reply = await generateReply(tweet.text, tweet.author_id);
          await replyToTweet(tweet.id, reply);
          replied++;
          await prisma.activity.create({
            data: { action: "Replied to new follow", detail: reply.slice(0, 80), icon: "💬" },
          });
          await sendMessage(
            `💬 *Commented on new follow*\n\n` +
            `_Their tweet:_ "${tweet.text.slice(0, 100)}"\n\n` +
            `*Reply:* ${reply.slice(0, 200)}`
          );
          await randomDelay(2000, 4000);
        } catch { /* skip */ }
      }
    }

    await prisma.activity.create({
      data: {
        action: `Follow run`,
        detail: `👤 ${followed} followed · ❤️ ${liked} liked · 💬 ${replied} replied · "${keyword}"`,
        icon: "🤝",
      },
    });

    await sendMessage(
      `🤝 *Follow run complete*\n\n` +
      `👤 Followed: *${followed}*\n` +
      `❤️ Liked: *${liked}*\n` +
      `💬 Replied: *${replied}*\n` +
      `_Topic: "${keyword}"_`
    );

    return NextResponse.json({ ok: true, followed, liked, replied, keyword });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
