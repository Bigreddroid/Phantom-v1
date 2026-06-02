import { NextResponse } from "next/server";
import { xClient } from "@/lib/x/client";
import { prisma } from "@/lib/db";
import { getLinkedInAuth } from "@/lib/linkedin/client";

export async function GET() {
  try {
    const [me, statsRow, liAuth] = await Promise.all([
      xClient.v2.me({ "user.fields": ["public_metrics"] }),
      prisma.stats.findUnique({ where: { id: "singleton" } }),
      getLinkedInAuth(),
    ]);

    const m = me.data.public_metrics ?? { followers_count: 0, following_count: 0, tweet_count: 0 };

    const [dmsSent, liPostsCount, engagements] = await Promise.all([
      prisma.activity.count({ where: { action: { contains: "DM" } } }),
      prisma.activity.count({ where: { icon: "💼" } }),
      prisma.activity.count({ where: { OR: [{ icon: "💬" }, { icon: "⚡" }, { icon: "🗣️" }] } }),
    ]);

    return NextResponse.json({
      followers: m.followers_count,
      following: m.following_count,
      tweets: m.tweet_count,
      engagements,
      dmsSent,
      liPosts: liPostsCount,
      linkedInConnected: !!liAuth,
      linkedInExpiry: liAuth ? liAuth.expiresAt.toISOString() : null,
      paused: statsRow?.paused ?? false,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json();
    const paused = action === "pause";
    await prisma.stats.upsert({
      where:  { id: "singleton" },
      update: { paused },
      create: { id: "singleton", paused },
    });
    await prisma.activity.create({
      data: { action: paused ? "Automation paused" : "Automation resumed", icon: paused ? "⏸️" : "▶️" },
    });
    return NextResponse.json({ ok: true, paused });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
