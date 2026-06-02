import { NextResponse } from "next/server";
import { getMentions, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { humanPause, randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";

function isSpam(text: string): boolean {
  const t = text.toLowerCase();
  const hasLink = /https?:\/\/\S+/.test(text);
  const spamWords = ["select", "winner", "congratul", "prize", "claim", "you've been", "you have been chosen", "dm to claim"];
  return (hasLink && spamWords.some(w => t.includes(w)))
    || /\b(click|tap) (here|this|the link)\b/i.test(text);
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [statsRow, isBlocked, me] = await Promise.all([
      prisma.stats.findUnique({ where: { id: "singleton" } }),
      loadBlocklist(),
      getMyProfile(),
    ]);

    if (statsRow?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

    // Only fetch mentions newer than the last one we already replied to
    const sinceId = statsRow?.lastMentionId ?? undefined;
    const mentions = await getMentions(me.id, sinceId);

    if (!mentions.length) {
      return NextResponse.json({ ok: true, mentions: 0 });
    }

    // Save the newest mention ID as the cursor for next run
    // Twitter returns newest first, so index 0 is the most recent
    const newestId = mentions[0].id;
    await prisma.stats.upsert({
      where:  { id: "singleton" },
      update: { lastMentionId: newestId },
      create: { id: "singleton", lastMentionId: newestId },
    });

    let replied = 0;
    const replyErrors: string[] = [];

    for (const mention of mentions) {
      if (isBlocked(mention.author_id)) continue;
      if (isSpam(mention.text)) continue; // skip silently — don't engage with bots
      await humanPause();

      try {
        const reply = await generateReply(mention.text, mention.author_id ?? "user");
        await replyToTweet(mention.id, reply);
        replied++;

        await prisma.activity.create({
          data: { action: "Replied to mention", detail: reply.slice(0, 80), icon: "💬" },
        });
        await sendMessage(
          `💬 *Replied to mention*\n\n` +
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
      await sendMessage(`⚠️ *Mentions: ${replyErrors.length} reply(s) failed*\n\`${replyErrors[0]}\``);
    }

    if (replied > 0) {
      await notifyPosted(`Replied to ${replied} mention${replied > 1 ? "s" : ""}`, "");
    }

    return NextResponse.json({ ok: true, mentions: replied, sinceId, newestId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
