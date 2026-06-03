import { NextResponse } from "next/server";
import { generateTweet, generateBuildUpdate } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { CONTENT_TOPICS } from "@/lib/config";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (shouldSkip(0.15)) {
    return NextResponse.json({ skipped: true, reason: "random skip" });
  }

  await humanPause();

  try {
    // Skip if there are already 2+ pending tweets waiting for approval
    const pendingCount = await prisma.queueItem.count({
      where: { type: "Tweet", status: "PENDING" },
    });
    if (pendingCount >= 2) {
      return NextResponse.json({ skipped: true, reason: "queue backed up" });
    }

    // Fetch last 15 posted tweets to avoid repeating content
    const recent = await prisma.activity.findMany({
      where: { action: { contains: "Tweet posted" } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { detail: true },
    });
    const recentTweets = recent.map(r => r.detail).filter(Boolean) as string[];

    // 30% chance: post a Phantom build update; 70%: regular content pillar tweet
    let content: string;
    if (Math.random() < 0.3) {
      content = await generateBuildUpdate("Phantom (my AI personal brand automation system for X/Twitter)");
    } else {
      const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
      content = await generateTweet(pillar, undefined, recentTweets);
    }
    // Dispatch passes ?image=true|false to signal content type; fallback to 30% chance
    const imageParam = new URL(req.url).searchParams.get("image");
    const withImage = imageParam === "true" ? true : imageParam === "false" ? false : Math.random() < 0.3;

    const item = await prisma.queueItem.create({
      data: { type: "Tweet", content, metadata: { withImage, cron: true } },
    });

    await requestApproval(
      withImage ? "Scheduled tweet + image" : "Scheduled tweet",
      content,
      { id: item.id }
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id });
  } catch (e) {
    await notifyError("Tweet cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
