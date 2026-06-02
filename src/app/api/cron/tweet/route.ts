import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
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
    const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
    const content = await generateTweet(pillar);
    const withImage = Math.random() < 0.3;

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
