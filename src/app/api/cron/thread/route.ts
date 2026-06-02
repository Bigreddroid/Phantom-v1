import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { postThread } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted, notifyError } from "@/lib/telegram/notify";
import { isActiveHour, shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { THREAD_TOPICS } from "@/lib/config";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (!isActiveHour() || shouldSkip(0.2)) {
    return NextResponse.json({ skipped: true });
  }

  await humanPause();

  try {
    const pillar = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
    const tweets = await generateThread(pillar, 5);

    const posted = await postThread(tweets);

    await prisma.activity.create({
      data: {
        action: `Thread posted (${tweets.length} tweets)`,
        detail: tweets[0].slice(0, 80),
        icon: "🧵",
      },
    });

    await notifyPosted(
      `Thread posted — ${tweets.length} tweets`,
      `*${pillar}*\n\n${tweets[0].slice(0, 200)}...`
    );

    return NextResponse.json({ ok: true, count: posted.length, pillar });
  } catch (e) {
    await notifyError("Thread cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
