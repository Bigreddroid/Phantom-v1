import { NextResponse } from "next/server";
import { xClient } from "@/lib/x/client";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const me = await xClient.v2.me({
      "user.fields": ["public_metrics"],
    });

    const m = me.data.public_metrics ?? { followers_count: 0, following_count: 0, tweet_count: 0, listed_count: 0 };

    // Count all individual likes from activity detail field
    const likeActivities = await prisma.activity.findMany({
      where: { icon: "❤️" },
      select: { action: true },
    });

    // Extract total likes from "Liked X tweets" entries
    const engagements = likeActivities.reduce((sum, a) => {
      const match = a.action.match(/Liked (\d+) tweets?/);
      return sum + (match ? parseInt(match[1]) : 1);
    }, 0);

    const [dmsSent, tweetsPosted] = await Promise.all([
      prisma.activity.count({ where: { action: { contains: "DM" } } }),
      prisma.activity.count({ where: { icon: "🐦" } }),
    ]);

    return NextResponse.json({
      followers: m.followers_count,
      following: m.following_count,
      tweets: m.tweet_count,
      tweetsPosted,
      engagements,
      dmsSent,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
