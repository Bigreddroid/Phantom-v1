import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { postThread } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";
import { THREAD_TOPICS } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const imageMode = (["none", "first", "all"].includes(body.images) ? body.images : "none") as "none" | "first" | "all";

    const pillar = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
    const tweets = await generateThread(pillar, 5);
    const posted = await postThread(tweets, imageMode);

    const hasImages = posted.some(p => p.hasImage);

    await prisma.activity.create({
      data: {
        action: `Thread posted (${tweets.length} tweets)`,
        detail: tweets[0].slice(0, 80),
        icon: hasImages ? "🖼️" : "🧵",
      },
    });

    await notifyPosted(
      `Thread posted — ${tweets.length} tweets${imageMode !== "none" ? " · with images" : ""}`,
      `*${pillar}*\n\n${tweets[0].slice(0, 200)}...`
    );

    return NextResponse.json({ ok: true, count: posted.length, pillar, hasImages });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
