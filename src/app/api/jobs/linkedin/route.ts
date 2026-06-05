export const maxDuration = 60;
import { NextResponse } from "next/server";
import { generateLinkedInPost } from "@/lib/claude/generate";
import { postToLinkedIn } from "@/lib/linkedin/post";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";
import { CONTENT_TOPICS } from "@/lib/config";
import { DEMO } from "@/lib/demo-data";

export async function POST() {
  if (DEMO) return NextResponse.json({ ok: true, demo: true, skipped: "demo mode" });
  try {
    const topic = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
    const content = await generateLinkedInPost(topic);
    const result = await postToLinkedIn(content);

    await prisma.activity.create({
      data: { action: "LinkedIn post published", detail: content.slice(0, 80), icon: "💼" },
    });

    await notifyPosted("LinkedIn post published", content.slice(0, 400));

    return NextResponse.json({ ok: true, id: result.id, content });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
