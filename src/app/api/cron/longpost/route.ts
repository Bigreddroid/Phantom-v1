import { NextResponse } from "next/server";
import { generateLongTweet } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyError } from "@/lib/telegram/notify";
import { shouldSkip } from "@/lib/scheduler/humanize";
import { CONTENT_TOPICS, THREAD_TOPICS } from "@/lib/config";

export const maxDuration = 60;

// All available long-post topics — mix of content pillars and thread angles reframed as essays
const LONG_POST_TOPICS = [
  ...CONTENT_TOPICS,
  ...THREAD_TOPICS,
  "one thing I wish I knew before building Phantom",
  "why automating your X presence is table stakes for solo founders in 2025",
  "the 3 decisions that defined how I build BigRedDroid",
  "what 90 days of building in public actually taught me",
  "why I chose to build and ship in public instead of staying in stealth",
  "the honest cost of building Phantom — time, money, and what I'd do differently",
  "how I keep shipping when motivation is low",
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (shouldSkip(0.1)) {
    return NextResponse.json({ skipped: true, reason: "random skip" });
  }

  try {
    // Pull recent posted content to avoid repeating angles
    const [postedItems, pendingItems] = await Promise.all([
      prisma.queueItem.findMany({
        where: { status: "POSTED" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { content: true },
      }),
      prisma.queueItem.findMany({
        where: { status: "PENDING" },
        select: { content: true },
        take: 10,
      }),
    ]);
    const recentTweets = [
      ...postedItems.map(q => q.content),
      ...pendingItems.map(q => q.content),
    ];

    const topic = LONG_POST_TOPICS[Math.floor(Math.random() * LONG_POST_TOPICS.length)];
    const content = await generateLongTweet(topic, recentTweets);

    const item = await prisma.queueItem.create({
      data: { type: "Tweet", content, metadata: { withImage: false, longpost: true, cron: true } },
    });

    await requestApproval("Long-form post (Premium+)", content, { id: item.id });

    return NextResponse.json({ ok: true, queued: true, id: item.id });
  } catch (e) {
    await notifyError("Long post cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
