import { NextResponse } from "next/server";

export const maxDuration = 55;
import { getMentions, getMyProfile } from "@/lib/x/engage";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { humanPause, randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { getRepliedTweetIds } from "@/lib/reply-dedup";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

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

    const sinceId = statsRow?.lastMentionId ?? undefined;
    const [mentions, repliedTweetIds] = await Promise.all([
      getMentions(me.id, sinceId),
      getRepliedTweetIds(true), // permanent — never queue a mention we already replied to
    ]);

    if (!mentions.length) {
      return NextResponse.json({ ok: true, mentions: 0 });
    }

    // Only advance cursor if newestId is a valid non-empty snowflake
    const newestId = mentions[0].id;
    if (newestId) {
      await prisma.stats.upsert({
        where:  { id: "singleton" },
        update: { lastMentionId: newestId },
        create: { id: "singleton", lastMentionId: newestId },
      });
    }

    let queued = 0;

    for (const mention of mentions) {
      if (isBlocked(mention.author_id)) continue;
      if (isSpam(mention.text)) continue;
      if (repliedTweetIds.has(mention.id)) continue; // already replied — permanent dedup

      // Skip if already in queue waiting for approval
      const alreadyQueued = await prisma.queueItem.findFirst({
        where: {
          type: "Mention",
          status: { in: ["PENDING", "APPROVED"] },
          metadata: { path: ["tweetId"], equals: mention.id },
        },
      });
      if (alreadyQueued) continue;

      await humanPause();

      try {
        // Pass authorId only when it's a real non-empty snowflake — avoids polluting thread memory with empty IDs
        const safeAuthorId = mention.author_id?.trim() || undefined;
        const reply = await generateReply(mention.text, mention.author_username ?? "user", safeAuthorId);

        const item = await prisma.queueItem.create({
          data: {
            type: "Mention",
            content: reply,
            metadata: {
              tweetId: mention.id,
              authorUsername: mention.author_username ?? "",
              authorId: mention.author_id ?? "",
              originalText: mention.text.slice(0, 280),
            },
          },
        });

        // Send to Telegram for approval — user must tap Send before it posts
        await fetch(`${BOT}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text:
              `💬 *Mention from @${mention.author_username || mention.author_id}*\n\n` +
              `_"${mention.text.slice(0, 280)}"_\n\n` +
              `*Phantom's reply:*\n${reply}`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Send",       callback_data: `approve_mention:${item.id}` },
                { text: "🔄 New reply",  callback_data: `regenerate:${item.id}` },
                { text: "✏️ Edit",       callback_data: `custom_mention:${item.id}` },
                { text: "❌ Skip",       callback_data: `skip_mention:${item.id}` },
              ]],
            },
          }),
        });

        queued++;
        await randomDelay(1500, 3000);
      } catch (e) {
        await sendMessage(`⚠️ *Mention queue failed*\n\`${String(e).slice(0, 80)}\``);
      }
    }

    if (queued > 0) {
      await sendMessage(`📬 *${queued} new mention${queued > 1 ? "s" : ""} waiting for your approval.*`);
    }

    return NextResponse.json({ ok: true, queued, sinceId, newestId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
