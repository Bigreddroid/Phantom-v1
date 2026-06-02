import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet, postThread } from "@/lib/x/post";
import { notifyPosted } from "@/lib/telegram/notify";

export async function GET() {
  const items = await prisma.queueItem.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const { id, action, editedContent } = await req.json();

  if (action === "reject") {
    await prisma.queueItem.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ ok: true });
  }

  const item = await prisma.queueItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const content = editedContent ?? item.content;

  try {
    if (item.type === "Thread") {
      const tweets = content.split("---").map((t: string) => t.trim()).filter(Boolean);
      await postThread(tweets);
    } else {
      await postTweet(content);
    }

    await prisma.queueItem.update({ where: { id }, data: { status: "POSTED" } });
    await prisma.activity.create({
      data: { action: `${item.type} posted`, detail: content.slice(0, 80), icon: "🐦" },
    });
    await notifyPosted(item.type, content.slice(0, 100));

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
