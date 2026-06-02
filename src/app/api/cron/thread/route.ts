import { NextResponse } from "next/server";
import { generateThread } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval } from "@/lib/telegram/notify";
import { isActiveHour, shouldSkip, humanPause } from "@/lib/scheduler/humanize";

const PILLARS = [
  "how I'm building a personal brand from scratch using AI",
  "5 automation tools every founder should know about",
  "what building in public actually looks like day to day",
  "how to grow on X without paying for ads",
  "the exact system I use to automate my personal brand",
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isActiveHour() || shouldSkip(0.2)) {
    return NextResponse.json({ skipped: true });
  }

  await humanPause();

  const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];
  const tweets = await generateThread(pillar, 5);
  const content = tweets.join("\n---\n");

  const item = await prisma.queueItem.create({
    data: { type: "Thread", content, metadata: { pillar, count: tweets.length, source: "cron" } },
  });

  await requestApproval("Post Thread", content.slice(0, 400) + "...", { pillar, id: item.id });

  return NextResponse.json({ ok: true, id: item.id });
}
