import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval } from "@/lib/telegram/notify";

const PILLARS = [
  "building a personal brand as a founder",
  "AI automation for solopreneurs",
  "lessons from building in public",
  "growing an audience without ads",
  "the intersection of tech and personal branding",
];

export async function POST() {
  try {
    const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];
    const content = await generateTweet(pillar);

    const item = await prisma.queueItem.create({
      data: { type: "Tweet", content, metadata: { pillar } },
    });

    await requestApproval("Post Tweet", content, { pillar, id: item.id });

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
