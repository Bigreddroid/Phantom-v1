import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval } from "@/lib/telegram/notify";

const PILLARS = [
  "how I'm building a personal brand from scratch using AI",
  "5 automation tools every founder should know",
  "what building in public actually looks like day to day",
  "how to grow on X without paying for ads",
];

export async function POST() {
  try {
    const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];
    const tweets = await generateThread(pillar, 5);
    const content = tweets.join("\n---\n");

    const item = await prisma.queueItem.create({
      data: { type: "Thread", content, metadata: { pillar, count: tweets.length } },
    });

    await requestApproval("Post Thread", content.slice(0, 400) + "...", { pillar, id: item.id });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
