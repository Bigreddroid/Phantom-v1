import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/claude/generate";
import { postTweet, postTweetWithImage } from "@/lib/x/post";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";

const PILLARS = [
  "building a personal brand as a founder",
  "AI automation for solopreneurs",
  "lessons from building in public",
  "growing an audience without ads",
  "the intersection of tech and personal branding",
  "how to turn expertise into authority online",
  "the compounding effect of daily content",
];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const withImage = body.image === true || Math.random() < 0.3;

    const pillar = PILLARS[Math.floor(Math.random() * PILLARS.length)];
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
