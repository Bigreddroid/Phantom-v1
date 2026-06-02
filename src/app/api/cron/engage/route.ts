import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { prisma } from "@/lib/db";
import { isActiveHour, randomDelay } from "@/lib/scheduler/humanize";

const KEYWORDS = [
  "founder personal brand",
  "building in public",
  "solopreneur automation",
  "AI tools for creators",
  "indiehacker growth",
  "personal brand tips",
  "content creator tools",
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

  // Pick 2 random keywords per run to vary engagement
  const shuffled = KEYWORDS.sort(() => Math.random() - 0.5).slice(0, 2);
  let totalEngaged = 0;

  for (const keyword of shuffled) {
    const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 5);

    for (const tweet of tweets) {
      if (tweet.author_id && tweet.author_id !== me.id) {
        await likeTweet(tweet.id, me.id);
        totalEngaged++;
        // Random delay between likes — 1.5s to 4s
        await randomDelay(1500, 4000);
      }
    }
  }

  if (totalEngaged > 0) {
    await prisma.activity.create({
      data: {
        action: `Liked ${totalEngaged} tweets`,
        detail: `Topics: ${shuffled.join(", ")}`,
        icon: "❤️",
      },
    });
  }

  return NextResponse.json({ ok: true, engaged: totalEngaged });
}
