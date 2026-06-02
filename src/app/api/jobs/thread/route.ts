import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval } from "@/lib/telegram/notify";
import { THREAD_TOPICS } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const imageMode = (["none", "first", "all"].includes(body.images) ? body.images : "none") as "none" | "first" | "all";

    const pillar = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
    const tweets = await generateThread(pillar, 5);
    const content = tweets.join("\n---\n");

    const item = await prisma.queueItem.create({
      data: { type: "Thread", content, metadata: { imageMode } },
    });

    await requestApproval(
      `Thread — ${tweets.length} tweets${imageMode !== "none" ? ` · ${imageMode === "first" ? "image on #1" : "images on all"}` : ""}`,
      `*${pillar}*\n\n${tweets[0]}\n\n[+ ${tweets.length - 1} more tweets]`,
      { id: item.id }
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id, count: tweets.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
