import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { postThread } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";

const PILLARS = [
  "how I'm building a personal brand from scratch using AI",
  "5 automation tools every founder should know",
  "what building in public actually looks like day to day",
  "how to grow on X without paying for ads",
  "the exact system I use to automate my personal brand",
  "why most founders fail at content — and how to fix it",
];

export async function POST() {
  try {
    const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];
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
