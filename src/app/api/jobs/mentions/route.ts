import { NextResponse } from "next/server";
import { getMentions, getMyProfile } from "@/lib/x/engage";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { requestApproval } from "@/lib/telegram/notify";

export async function POST() {
  try {
    const me = await getMyProfile();
    const mentions = await getMentions(me.id);

    if (!mentions.length) {
      return NextResponse.json({ ok: true, mentions: 0 });
    }

    for (const mention of mentions) {
      const reply = await generateReply(mention.text, mention.author_id ?? "user");

      const item = await prisma.queueItem.create({
        data: {
          type: "Reply",
          content: reply,
          metadata: { tweetId: mention.id, original: mention.text.slice(0, 100) },
        },
      });

      await requestApproval("Reply to Mention", reply, {
        original: mention.text.slice(0, 80),
        id: item.id,
      });
    }

    await prisma.activity.create({
      data: { action: `${mentions.length} mentions queued for reply`, icon: "💬" },
    });

    return NextResponse.json({ ok: true, mentions: mentions.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
