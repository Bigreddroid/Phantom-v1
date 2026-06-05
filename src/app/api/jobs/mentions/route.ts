export const maxDuration = 60;
import { NextResponse } from "next/server";
import { getMentions, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted } from "@/lib/telegram/notify";
import { humanPause, randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { sendMessage } from "@/lib/telegram/notify";
import { DEMO } from "@/lib/demo-data";

export async function POST() {
  if (DEMO) return NextResponse.json({ ok: true, demo: true, skipped: "demo mode" });
  try {
    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();
    const mentions = await getMentions(me.id);

    if (!mentions.length) {
      return NextResponse.json({ ok: true, mentions: 0 });
    }

    // Load mention IDs already replied to in the last 7 days — prevents re-replying on every run
    const recentReplied = await prisma.activity.findMany({
      where: { action: "Replied to mention", createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      select: { detail: true },
      take: 500,
    });
    const repliedMentionIds = new Set(
      recentReplied.map(a => a.detail?.match(/^mid:(\w+)/)?.[1]).filter(Boolean) as string[]
    );

    let replied = 0;
    for (const mention of mentions) {
      if (isBlocked(mention.author_id)) continue;
      if (repliedMentionIds.has(mention.id)) continue; // already replied
      await humanPause();

      try {
        const reply = await generateReply(mention.text, mention.author_id ?? "user");
        await replyToTweet(mention.id, reply);
        replied++;

        await prisma.activity.create({
          data: { action: "Replied to mention", detail: `mid:${mention.id}|${reply.slice(0, 70)}`, icon: "💬" },
        });
        await sendMessage(
          `💬 *Replied to mention on X*\n\n` +
          `_They said:_ "${mention.text.slice(0, 120)}"\n\n` +
          `*Reply:* ${reply.slice(0, 200)}`
        );
        await randomDelay(2000, 5000);
      } catch { /* skip */ }
    }

    if (replied > 0) {
      await notifyPosted(`Replied to ${replied} mention${replied > 1 ? "s" : ""}`, "");
    }

    return NextResponse.json({ ok: true, mentions: replied });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
