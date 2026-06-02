import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { postThread } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";
import { THREAD_TOPICS } from "@/lib/config";

export async function POST() {
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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
