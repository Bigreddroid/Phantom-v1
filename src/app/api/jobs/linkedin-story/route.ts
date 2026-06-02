import { NextResponse } from "next/server";
import { generateLinkedInStory } from "@/lib/claude/generate";
import { postToLinkedIn } from "@/lib/linkedin/post";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";

export async function POST() {
  try {
    // Pull the last 3 X posts as source material for the story
    const recentPosts = await prisma.activity.findMany({
      where: { icon: { in: ["🐦", "🧵"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { detail: true },
    });

    const tweets = recentPosts.map(p => p.detail ?? "").filter(Boolean);
    const content = await generateLinkedInStory(tweets);
    const result = await postToLinkedIn(content);

    await prisma.activity.create({
      data: { action: "LinkedIn story published", detail: content.slice(0, 80), icon: "💼" },
    });

    await notifyPosted("LinkedIn story published", content.slice(0, 400));

    return NextResponse.json({ ok: true, id: result.id, content });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
