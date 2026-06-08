import { NextResponse } from "next/server";

export const maxDuration = 55;
import { getMentions } from "@/lib/x/engage";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { humanPause, randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { getRepliedTweetIds } from "@/lib/reply-dedup";
import { getUserCtx, getStatsPaused, upsertStats } from "@/lib/user-context";

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

  const userId = new URL(req.url).searchParams.get("userId") ?? null;
  const ctx = await getUserCtx(userId).catch(() => null);
  if (userId && !ctx) return NextResponse.json({ error: "User context unavailable" }, { status: 404 });

  const tg = ctx?.telegram;

  try {
    const [paused, isBlocked, statsRow] = await Promise.all([
      getStatsPaused(userId),
      loadBlocklist(),
      getStatsRow(userId),
    ]);

    if (paused) return NextResponse.json({ skipped: true, reason: "paused" });

    const sinceId = statsRow?.lastMentionId ?? undefined;
    const [mentions, repliedTweetIds] = await Promise.all([
      getMentions(undefined, sinceId, ctx ? { rClient: ctx.scraperR, username: ctx.username } : undefined),
      getRepliedTweetIds(true),
    ]);

    if (!mentions.length) {
      return NextResponse.json({ ok: true, mentions: 0 });
    }

    const newestId = mentions[0].id;
    if (newestId) {
      await upsertStats(userId, { lastMentionId: newestId });
    }

    let queued = 0;

    for (const mention of mentions) {
      if (isBlocked(mention.author_id)) continue;
      if (isSpam(mention.text)) continue;
      if (repliedTweetIds.has(mention.id)) continue;

      const alreadyQueued = await prisma.queueItem.findFirst({
        where: {
          userId: userId ?? null,
          type: "Mention",
          status: { in: ["PENDING", "APPROVED"] },
          metadata: { path: ["tweetId"], equals: mention.id },
        },
      });
      if (alreadyQueued) continue;

      await humanPause();

      try {
        const safeAuthorId = mention.author_id?.trim() || undefined;
        const reply = await generateReply(mention.text, mention.author_username ?? "user", safeAuthorId);

        const item = await prisma.queueItem.create({
          data: {
            userId: userId ?? null,
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

        const botUrl = tg?.botUrl ?? `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
        const chatId = tg?.chatId ?? process.env.TELEGRAM_CHAT_ID;
        await fetch(`${botUrl}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
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
        await sendMessage(`⚠️ *Mention queue failed*\n\`${String(e).slice(0, 80)}\``, tg);
      }
    }

    if (queued > 0) {
      await sendMessage(`📬 *${queued} new mention${queued > 1 ? "s" : ""} waiting for your approval.*`, tg);
    }

    return NextResponse.json({ ok: true, queued, sinceId, newestId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function getStatsRow(userId: string | null) {
  return userId
    ? prisma.stats.findFirst({ where: { userId } })
    : prisma.stats.findUnique({ where: { id: "singleton" } });
}
