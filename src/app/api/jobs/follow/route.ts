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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const count = Math.min(Number(body.count) || 5, 20);

  try {
    const me = await getMyProfile();
    let followed = 0, liked = 0, replied = 0;
    const seen = new Set<string>();

    for (const keyword of KEYWORDS) {
      if (followed >= count) break;

      const verifiedTweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 10);
      const normalTweets = await searchTweets(`${keyword} -is:retweet lang:en -is:verified`, 10);
      const tweets = [...verifiedTweets, ...normalTweets.slice(0, 1)];

      for (const tweet of tweets) {
        if (followed >= count) break;
        if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id)) continue;
        seen.add(tweet.author_id);

        try { await followUser(tweet.author_id, me.id); followed++; } catch { /* already following */ }
        await randomDelay(1000, 2500);

        try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
        await randomDelay(500, 1500);

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
    }

    await prisma.activity.create({
      data: {
        action: `Follow run (manual)`,
        detail: `👤 ${followed} · ❤️ ${liked} · 💬 ${replied}`,
        icon: "🤝",
      },
    });

    return NextResponse.json({ ok: true, followed, liked, replied });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
