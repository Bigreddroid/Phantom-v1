import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyError } from "@/lib/telegram/notify";
import { isActiveHour, shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { THREAD_TOPICS } from "@/lib/config";
import { getUserCtx, getStatsPaused } from "@/lib/user-context";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId") ?? null;
  const ctx = await getUserCtx(userId).catch(() => null);
  if (userId && !ctx) return NextResponse.json({ error: "User context unavailable" }, { status: 404 });

  const tg = ctx?.telegram;

  const paused = await getStatsPaused(userId);
  if (paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (!isActiveHour() || shouldSkip(0.2)) {
    return NextResponse.json({ skipped: true });
  }

  await humanPause();

  try {
    const userFilter = userId ? { userId } : { userId: null };

    const [postedItems, pendingItems] = await Promise.all([
      prisma.queueItem.findMany({
        where: { ...userFilter, status: "POSTED", type: { in: ["Tweet", "Thread"] } },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: { content: true, metadata: true },
      }),
      prisma.queueItem.findMany({
        where: { ...userFilter, status: "PENDING", type: { in: ["Tweet", "Thread"] } },
        select: { content: true, metadata: true },
        take: 10,
      }),
    ]);

    const recentTweets = [
      ...postedItems.map(q => q.content),
      ...pendingItems.map(q => q.content),
    ];

    const usedTopics = new Set([
      ...postedItems.map(q => (q.metadata as Record<string, unknown>)?.topic as string).filter(Boolean),
      ...pendingItems.map(q => (q.metadata as Record<string, unknown>)?.topic as string).filter(Boolean),
    ]);
    const freshTopics = THREAD_TOPICS.filter(t => !usedTopics.has(t));
    const topicPool = freshTopics.length ? freshTopics : THREAD_TOPICS;
    const pillar = topicPool[Math.floor(Math.random() * topicPool.length)];

    const tweets = await generateThread(pillar, 5, recentTweets);
    const content = tweets.join("\n---\n");

    const item = await prisma.queueItem.create({
      data: { userId: userId ?? null, type: "Thread", content, metadata: { imageMode: "none", cron: true, topic: pillar } },
    });

    await requestApproval(
      `Scheduled thread — ${tweets.length} tweets`,
      `*${pillar}*\n\n${tweets[0]}\n\n[+ ${tweets.length - 1} more tweets]`,
      { id: item.id },
      tg
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id, pillar });
  } catch (e) {
    await notifyError("Thread cron", String(e), tg);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
