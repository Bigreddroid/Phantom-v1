import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
import { postTweet, postTweetWithImage } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";
import { CONTENT_TOPICS } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const withImage = body.image === true || Math.random() < 0.3;

    const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
    const content = await generateTweet(pillar);

    const result = withImage
      ? await postTweetWithImage(content)
      : await postTweet(content);

    const hasImage = withImage && (result as { hasImage?: boolean }).hasImage;

    await prisma.activity.create({
      data: {
        action: "Tweet posted",
        detail: content.slice(0, 80),
        icon: hasImage ? "🖼️" : "🐦",
      },
    });

    await notifyPosted(
      hasImage ? "Tweet posted with image" : "Tweet posted",
      content
    );

    return NextResponse.json({ ok: true, id: result.id, content, hasImage });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
