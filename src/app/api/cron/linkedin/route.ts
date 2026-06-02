import { NextResponse } from "next/server";
import { generateLinkedInPost } from "@/lib/claude/generate";
import { postToLinkedIn } from "@/lib/linkedin/post";
import { prisma } from "@/lib/db";
import { notifyPosted, notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { CONTENT_TOPICS } from "@/lib/config";
import { getLinkedInAuth } from "@/lib/linkedin/client";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  // Skip silently if LinkedIn isn't connected — avoids noisy errors in cron logs
  const liAuth = await getLinkedInAuth();
  if (!liAuth) return NextResponse.json({ skipped: true, reason: "linkedin not connected" });

  if (shouldSkip(0.1)) {
    return NextResponse.json({ skipped: true, reason: "random skip" });
  }

  await humanPause();

  try {
    const topic = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
    const content = await generateLinkedInPost(topic);
    const result = await postToLinkedIn(content);

    await prisma.activity.create({
      data: { action: "LinkedIn post published", detail: content.slice(0, 80), icon: "💼" },
    });

    await notifyPosted("LinkedIn post published", content.slice(0, 400));

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    await notifyError("LinkedIn cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
