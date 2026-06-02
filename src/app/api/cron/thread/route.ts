import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval, notifyError } from "@/lib/telegram/notify";
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
    const content = tweets.join("\n---\n");

    const item = await prisma.queueItem.create({
      data: { type: "Thread", content, metadata: { imageMode: "none", cron: true } },
    });

    await requestApproval(
      `Scheduled thread — ${tweets.length} tweets`,
      `*${pillar}*\n\n${tweets[0]}\n\n[+ ${tweets.length - 1} more tweets]`,
      { id: item.id }
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id, pillar });
  } catch (e) {
    await notifyError("Thread cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
