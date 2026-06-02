import { NextResponse } from "next/server";
import { getMentions, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";
import { humanPause, randomDelay } from "@/lib/scheduler/humanize";

export async function POST() {
  try {
    const me = await getMyProfile();
    const mentions = await getMentions(me.id);

    if (!mentions.length) {
      return NextResponse.json({ ok: true, mentions: 0 });
    }

    let replied = 0;
    for (const mention of mentions) {
      await humanPause();

      const reply = await generateReply(mention.text, mention.author_id ?? "user");
      await replyToTweet(mention.id, reply);
      replied++;

      await prisma.activity.create({
        data: { action: "Replied to mention", detail: reply.slice(0, 80), icon: "💬" },
      });

      await randomDelay(2000, 5000);
    }

    if (replied > 0) {
      await notifyPosted(
        `Replied to ${replied} mention${replied > 1 ? "s" : ""}`,
        mentions.map(m => `• ${m.text.slice(0, 60)}`).join("\n")
      );
    }

    return NextResponse.json({ ok: true, mentions: replied });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
