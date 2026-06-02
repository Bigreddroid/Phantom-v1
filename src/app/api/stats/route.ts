import { NextResponse } from "next/server";
import { xClient } from "@/lib/x/client";
import { prisma } from "@/lib/db";
import { getLinkedInAuth } from "@/lib/linkedin/client";

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

    const [dmsSent, tweetsPosted, liPostsCount, liAuth] = await Promise.all([
      prisma.activity.count({ where: { action: { contains: "DM" } } }),
      prisma.activity.count({ where: { icon: "🐦" } }),
      prisma.activity.count({ where: { icon: "💼" } }),
      getLinkedInAuth(),
    ]);

    return NextResponse.json({
      followers: m.followers_count,
      following: m.following_count,
      tweets: m.tweet_count,
      tweetsPosted,
      engagements,
      dmsSent,
      liPosts: liPostsCount,
      linkedInConnected: !!liAuth,
      linkedInExpiry: liAuth ? liAuth.expiresAt.toISOString() : null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
