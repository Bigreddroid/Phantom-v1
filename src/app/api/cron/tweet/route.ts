import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval } from "@/lib/telegram/notify";
import { isActiveHour, shouldSkip, humanPause } from "@/lib/scheduler/humanize";

const PILLARS = [
  "building a personal brand as a founder",
  "AI automation for solopreneurs",
  "lessons from building in public",
  "growing an audience without spending money on ads",
  "the intersection of tech and personal branding",
  "why consistency beats virality",
  "what I'm learning building Phantom",
];

export async function GET(req: Request) {
  // Verify cron secret so only Vercel can trigger this
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isActiveHour()) {
    return NextResponse.json({ skipped: true, reason: "outside active hours" });
  }

  // 15% chance to skip — humans don't post every single day
  if (shouldSkip(0.15)) {
    return NextResponse.json({ skipped: true, reason: "random skip" });
  }

  await humanPause();

  const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];
  const content = await generateTweet(pillar);

  const item = await prisma.queueItem.create({
    data: { type: "Tweet", content, metadata: { pillar, source: "cron" } },
  });

  await requestApproval("Post Tweet", content, { pillar, id: item.id });

  return NextResponse.json({ ok: true, id: item.id });
}
