import { NextResponse } from "next/server";
import { xClient } from "@/lib/x/client";
import { prisma } from "@/lib/db";
import { notifyDailySummary, notifyMilestone } from "@/lib/telegram/notify";

const MILESTONES = [10, 50, 100, 250, 500, 1000, 5000, 10000];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await xClient.v2.me({ "user.fields": ["public_metrics"] });
  const m = { followers_count: 0, tweet_count: 0, ...me.data.public_metrics };
  const currentFollowers = m.followers_count;

  const since = new Date(Date.now() - 86400000); // last 24h

  const [tweetsPosted, engagements, mentions, dmsSent, statsRecord] = await Promise.all([
    prisma.activity.count({ where: { action: { contains: "posted" }, createdAt: { gte: since } } }),
    prisma.activity.count({ where: { action: { contains: "Liked" }, createdAt: { gte: since } } }),
    prisma.activity.count({ where: { action: { contains: "mention" }, createdAt: { gte: since } } }),
    prisma.activity.count({ where: { action: { contains: "DM" }, createdAt: { gte: since } } }),
    prisma.stats.findUnique({ where: { id: "singleton" } }),
  ]);

  // Delta since last summary run (0 on first run — seeds the baseline)
  const followerGain = statsRecord && statsRecord.followers > 0
    ? Math.max(0, currentFollowers - statsRecord.followers)
    : 0;

  // Persist today's count for tomorrow's delta
  await prisma.stats.upsert({
    where: { id: "singleton" },
    update: { followers: currentFollowers },
    create: { followers: currentFollowers },
  });

  await notifyDailySummary({
    followers: currentFollowers,
    followerGain,
    tweetsPosted,
    engagements,
    mentions,
    dmsSent,
  });

  // Check milestones
  for (const ms of MILESTONES) {
    if (m.followers_count >= ms) {
      const key = `milestone_${ms}`;
      const hit = await prisma.activity.findFirst({ where: { action: key } });
      if (!hit) {
        await notifyMilestone(ms);
        await prisma.activity.create({ data: { action: key, icon: "🎯" } });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
