import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
import { postTweet, postTweetWithImage } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted, notifyError } from "@/lib/telegram/notify";
import { shouldSkip, humanPause } from "@/lib/scheduler/humanize";
import { CONTENT_TOPICS } from "@/lib/config";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (shouldSkip(0.15)) {
    return NextResponse.json({ skipped: true, reason: "random skip" });
  }

  await humanPause();

  try {
    const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
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
