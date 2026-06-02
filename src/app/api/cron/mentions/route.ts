import { NextResponse } from "next/server";
import { getMentions, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { humanPause, randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
    if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();
    const mentions = await getMentions(me.id);

    if (!mentions.length) {
      return NextResponse.json({ ok: true, mentions: 0 });
    }

    let replied = 0;
    const replyErrors: string[] = [];
    for (const mention of mentions) {
      if (isBlocked(mention.author_id)) continue;
      await humanPause();

      try {
        const reply = await generateReply(mention.text, mention.author_id ?? "user");
        await replyToTweet(mention.id, reply);
        replied++;

        await prisma.activity.create({
          data: { action: "Replied to mention", detail: reply.slice(0, 80), icon: "💬" },
        });
        await sendMessage(
          `💬 *Replied to mention on X*\n\n` +
          `_They said:_ "${mention.text.slice(0, 120)}"\n\n` +
          `*Reply:* ${reply.slice(0, 200)}`
        );
        await randomDelay(2000, 5000);
      } catch (e) {
        replyErrors.push(String(e).slice(0, 80));
        await prisma.activity.create({
          data: { action: "Mention reply failed", detail: String(e).slice(0, 80), icon: "❌" },
        });
      }
    }

    if (replyErrors.length > 0) {
      await sendMessage(`⚠️ *Mentions cron: ${replyErrors.length} reply(s) failed*\n\n\`${replyErrors[0]}\``);
    }

    if (replied > 0) {
      await notifyPosted(`Replied to ${replied} mention${replied > 1 ? "s" : ""}`, "");
    }

    return NextResponse.json({ ok: true, mentions: replied });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
