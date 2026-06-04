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
    // Skip if there are already 2+ pending tweets created in the last 2 hours.
    // Older stale items (from when the bot was broken) don't count — they'd block indefinitely.
    const pendingCount = await prisma.queueItem.count({
      where: {
        type: "Tweet",
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
    });
    if (pendingCount >= 2) {
      return NextResponse.json({ skipped: true, reason: "queue backed up" });
    }

    // Pull full tweet history from QueueItem (POSTED = actually went live, untruncated)
    // + Activity fallback for older records + pending queue
    const [postedItems, pendingQueue] = await Promise.all([
      prisma.queueItem.findMany({
        where: { status: "POSTED", type: { in: ["Tweet", "Thread"] } },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: { content: true },
      }),
      prisma.queueItem.findMany({
        where: { status: "PENDING", type: { in: ["Tweet", "Thread"] } },
        select: { content: true },
        take: 10,
      }),
    ]);
    const recentTweets = [
      ...postedItems.map(q => q.content),
      ...pendingQueue.map(q => q.content),
    ];

    // 40% build update, 60% content pillar — was 50/50 but build updates were dominating
    let content: string;
    if (Math.random() < 0.4) {
      const products = [
        "Phantom (my AI personal brand automation system for X/Twitter, live now under BigRedDroid)",
        "BigRedDroid — building 92 AI products solo, Phantom is #1",
        "BigRedDroid — my solo deep-tech lab, Phantom is the flagship product",
      ];
      content = await generateBuildUpdate(
        products[Math.floor(Math.random() * products.length)],
        undefined,
        recentTweets,
      );
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
