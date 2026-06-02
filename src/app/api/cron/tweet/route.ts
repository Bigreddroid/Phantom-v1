import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
import { postTweet, postTweetWithImage } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted, notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";

const PILLARS = [
  "building a personal brand as a founder",
  "AI automation for solopreneurs",
  "lessons from building in public",
  "growing an audience without spending money on ads",
  "the intersection of tech and personal branding",
  "why consistency beats virality",
  "what I'm learning building Phantom",
  "how to turn expertise into authority online",
  "the compounding effect of daily content",
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (shouldSkip(0.15)) {
    return NextResponse.json({ skipped: true, reason: "random skip" });
  }

  await humanPause();

  try {
    const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];
    const content = await generateTweet(pillar);

    // 30% chance to attach a branded image
    const withImage = Math.random() < 0.3;
    const result = withImage
      ? await postTweetWithImage(content)
      : await postTweet(content);

    await prisma.activity.create({
      data: {
        action: "Tweet posted",
        detail: content.slice(0, 80),
        icon: withImage && (result as { hasImage?: boolean }).hasImage ? "🖼️" : "🐦",
      },
    });

    await notifyPosted(
      withImage ? "Tweet posted with image" : "Tweet posted",
      content
    );

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    await notifyError("Tweet cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
