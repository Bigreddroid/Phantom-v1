import { NextResponse } from "next/server";
import { generateArticleThread } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { ARTICLE_TOPICS } from "@/lib/config";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (shouldSkip(0.1)) return NextResponse.json({ skipped: true, reason: "random skip" });

  await humanPause();

  try {
    // Pull recent content for dedup
    const [postedItems, pendingItems] = await Promise.all([
      prisma.queueItem.findMany({
        where: { status: "POSTED", type: { in: ["Tweet", "Thread"] } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { content: true, metadata: true },
      }),
      prisma.queueItem.findMany({
        where: { status: "PENDING", type: { in: ["Tweet", "Thread"] } },
        select: { content: true, metadata: true },
        take: 10,
      }),
    ]);

    const recentTweets = [
      ...postedItems.map(q => q.content),
      ...pendingItems.map(q => q.content),
    ];

    // Avoid recently used article topics
    const usedTopics = new Set([
      ...postedItems.map(q => (q.metadata as Record<string, unknown>)?.topic as string).filter(Boolean),
      ...pendingItems.map(q => (q.metadata as Record<string, unknown>)?.topic as string).filter(Boolean),
    ]);
    const freshTopics = ARTICLE_TOPICS.filter(t => !usedTopics.has(t));
    const topicPool = freshTopics.length ? freshTopics : ARTICLE_TOPICS;
    const topic = topicPool[Math.floor(Math.random() * topicPool.length)];

    const tweets = await generateArticleThread(topic, recentTweets);
    const content = tweets.join("\n---\n");

    // imageMode: "first" = cover image on tweet 1 only, imageStyle: "article" = article template pool
    const item = await prisma.queueItem.create({
      data: {
        type: "Thread",
        content,
        metadata: { imageMode: "first", imageStyle: "article", article: true, cron: true, topic },
      },
    });

    await requestApproval(
      `📰 Article thread — ${tweets.length} tweets · cover image auto-set`,
      `*${topic}*\n\n${tweets[0]}\n\n[+ ${tweets.length - 1} more tweets]`,
      { id: item.id }
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id, topic });
  } catch (e) {
    await notifyError("Article cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
