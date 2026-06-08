import { NextResponse } from "next/server";
import { generateTweet, generateBuildUpdate } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { CONTENT_TOPICS } from "@/lib/config";
import { getUserCtx, getStatsPaused } from "@/lib/user-context";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? null;
  const ctx = await getUserCtx(userId).catch(() => null);
  if (userId && !ctx) return NextResponse.json({ error: "User context unavailable" }, { status: 404 });

  const tg = ctx?.telegram;

  const paused = await getStatsPaused(userId);
  if (paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (shouldSkip(0.15)) {
    return NextResponse.json({ skipped: true, reason: "random skip" });
  }

  await humanPause();

  try {
    const userFilter = userId ? { userId } : { userId: null };

    const pendingCount = await prisma.queueItem.count({
      where: {
        ...userFilter,
        type: "Tweet",
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
    });
    if (pendingCount >= 2) {
      return NextResponse.json({ skipped: true, reason: "queue backed up" });
    }

    const [postedItems, pendingQueue] = await Promise.all([
      prisma.queueItem.findMany({
        where: { ...userFilter, status: "POSTED", type: { in: ["Tweet", "Thread"] } },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: { content: true },
      }),
      prisma.queueItem.findMany({
        where: { ...userFilter, status: "PENDING", type: { in: ["Tweet", "Thread"] } },
        select: { content: true },
        take: 10,
      }),
    ]);
    const recentTweets = [
      ...postedItems.map(q => q.content),
      ...pendingQueue.map(q => q.content),
    ];

    // For SaaS users: always use content pillar (build updates are Varun-specific)
    let content: string;
    if (!userId && Math.random() < 0.4) {
      const products = [
        "Phantom (my AI personal brand automation system for X/Twitter, live now under BigRedDroid)",
        "BigRedDroid — solo product lab, Phantom is the flagship",
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

    const imageParam = url.searchParams.get("image");
    const withImage = imageParam === "true" ? true : imageParam === "false" ? false : Math.random() < 0.3;

    const item = await prisma.queueItem.create({
      data: { userId: userId ?? null, type: "Tweet", content, metadata: { withImage, cron: true } },
    });

    await requestApproval(
      withImage ? "Scheduled tweet + image" : "Scheduled tweet",
      content,
      { id: item.id },
      tg
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id });
  } catch (e) {
    await notifyError("Tweet cron", String(e), tg);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
