export const maxDuration = 60;
import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval } from "@/lib/telegram/notify";
import { CONTENT_TOPICS } from "@/lib/config";
import { DEMO } from "@/lib/demo-data";

export async function POST(req: Request) {
  if (DEMO) return NextResponse.json({ ok: true, demo: true, skipped: "demo mode" });
  try {
    const body = await req.json().catch(() => ({}));
    const withImage = body.image === true || Math.random() < 0.3;

    const recent = await prisma.activity.findMany({
      where: { action: { contains: "Tweet posted" } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { detail: true },
    });
    const recentTweets = recent.map(r => r.detail).filter(Boolean) as string[];

    const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
    const content = await generateTweet(pillar, undefined, recentTweets);

    const item = await prisma.queueItem.create({
      data: { type: "Tweet", content, metadata: { withImage } },
    });

    await requestApproval(
      withImage ? "Tweet + image" : "Tweet",
      content,
      { id: item.id }
    );

    return NextResponse.json({ ok: true, queued: true, id: item.id, content });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
