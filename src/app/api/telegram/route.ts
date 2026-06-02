import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet, postThread } from "@/lib/x/post";
import { searchTweets, followUser, getMyProfile } from "@/lib/x/engage";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const ALLOWED_CHAT = process.env.TELEGRAM_CHAT_ID!;

async function reply(chatId: string, text: string, markup?: object) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...(markup ? { reply_markup: markup } : {}),
    }),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Handle inline button callbacks (approve/reject)
  if (body.callback_query) {
    const { data, from, message } = body.callback_query;
    const chatId = String(from.id);

    if (chatId !== ALLOWED_CHAT) return NextResponse.json({ ok: true });

    const [action, id] = data.split(":");

    if (action === "approve") {
      const item = await prisma.queueItem.findUnique({ where: { id } });
      if (!item) {
        await reply(chatId, "❌ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      try {
        if (item.type === "Thread") {
          const tweets = item.content.split("---").map((t: string) => t.trim()).filter(Boolean);
          await postThread(tweets);
        } else {
          await postTweet(item.content);
        }
        await prisma.queueItem.update({ where: { id }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: `${item.type} posted`, detail: item.content.slice(0, 80), icon: "🐦" },
        });
        await reply(chatId, `✅ *Posted to X*\n\n${item.content.slice(0, 200)}`);
      } catch (e) {
        await reply(chatId, `❌ Failed to post: ${String(e).slice(0, 100)}`);
      }
    }

    if (action === "reject") {
      await prisma.queueItem.update({ where: { id }, data: { status: "REJECTED" } });
      await reply(chatId, "❌ Rejected and removed from queue.");
    }

    // Answer callback to remove loading state
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: body.callback_query.id }),
    });

    return NextResponse.json({ ok: true });
  }

  // Handle text commands
  const msg = body.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = String(msg.chat.id);
  if (chatId !== ALLOWED_CHAT) return NextResponse.json({ ok: true });

  const cmd = msg.text.trim().toLowerCase();

  if (cmd === "/start" || cmd === "/help") {
    await reply(chatId,
      `*🤖 Phantom Commands*\n\n` +
      `*/status* — live stats\n` +
      `*/queue* — pending approvals\n` +
      `*/schedule* — automation schedule\n` +
      `*/tweet* — generate a tweet now\n` +
      `*/thread* — generate a thread now\n` +
      `*/engage* — run engagement now\n` +
      `*/mentions* — check mentions now\n` +
      `*/follow* — follow + like + AI-reply to 5 niche accounts\n` +
      `*/follow 10* — same but N accounts (max 15)\n` +
      `*/pause* — pause all automation\n` +
      `*/resume* — resume automation\n`
    );
  }

  else if (cmd === "/status") {
    const [followers, queued, posted] = await Promise.all([
      fetch(`${process.env.NEXTAUTH_URL}/api/stats`).then(r => r.json()).catch(() => ({})),
      prisma.queueItem.count({ where: { status: "PENDING" } }),
      prisma.activity.count({ where: { icon: "🐦" } }),
    ]);
    await reply(chatId,
      `*📊 Phantom Status*\n\n` +
      `*Followers:* ${followers.followers ?? "—"}\n` +
      `*Tweets posted:* ${followers.tweets ?? "—"}\n` +
      `*Queue pending:* ${queued}\n` +
      `*Total posted:* ${posted}\n` +
      `*Engagements:* ${followers.engagements ?? "—"}\n\n` +
      `_Phantom is running._`
    );
  }

  else if (cmd === "/queue") {
    const items = await prisma.queueItem.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (!items.length) {
      await reply(chatId, "✅ Queue is empty — nothing pending.");
    } else {
      for (const item of items) {
        await reply(chatId,
          `*${item.type}*\n\n${item.content.slice(0, 300)}`,
          {
            inline_keyboard: [[
              { text: "✅ Approve", callback_data: `approve:${item.id}` },
              { text: "❌ Reject", callback_data: `reject:${item.id}` },
            ]],
          }
        );
      }
    }
  }

  else if (cmd === "/schedule") {
    await reply(chatId,
      `*⏰ Automation Schedule (IST)*\n\n` +
      `*Tweets* — 7:30am · 12:30pm · 6:30pm\n_3x/day · 15% skip chance_\n\n` +
      `*Threads* — Mon & Thu 2:30pm\n_2x/week · 20% skip chance_\n\n` +
      `*Engagement* — Every 2h, 7am–10pm\n_Likes + replies to niche accounts_\n\n` +
      `*Mentions* — Every 30 minutes\n_Replies queued for approval_\n\n` +
      `*Daily summary* — 11:30pm\n_Telegram report_`
    );
  }

  else if (cmd === "/tweet") {
    await reply(chatId, "⚙️ Generating tweet...");
    await fetch(`${process.env.NEXTAUTH_URL}/api/jobs/tweet`, { method: "POST" });
    await reply(chatId, "✅ Tweet generated — check your approval queue.");
  }

  else if (cmd === "/thread") {
    await reply(chatId, "⚙️ Generating thread...");
    await fetch(`${process.env.NEXTAUTH_URL}/api/jobs/thread`, { method: "POST" });
    await reply(chatId, "✅ Thread generated — check your approval queue.");
  }

  else if (cmd === "/engage") {
    await reply(chatId, "⚙️ Running engagement...");
    await fetch(`${process.env.NEXTAUTH_URL}/api/jobs/engage`, { method: "POST" });
    await reply(chatId, "✅ Engagement run complete — check activity log.");
  }

  else if (cmd === "/mentions") {
    await reply(chatId, "⚙️ Checking mentions...");
    await fetch(`${process.env.NEXTAUTH_URL}/api/jobs/mentions`, { method: "POST" });
    await reply(chatId, "✅ Mentions checked — replies queued if any.");
  }

  else if (cmd === "/pause") {
    await prisma.activity.create({ data: { action: "Automation paused", icon: "⏸️" } });
    await reply(chatId, "⏸️ Automation paused. Send /resume to restart.");
  }

  else if (cmd === "/resume") {
    await prisma.activity.create({ data: { action: "Automation resumed", icon: "▶️" } });
    await reply(chatId, "▶️ Automation resumed.");
  }

  else if (cmd.startsWith("/follow")) {
    const parts = cmd.split(" ");
    const count = Math.min(parseInt(parts[1] ?? "5", 10) || 5, 15);

    await reply(chatId, `🧠 Scanning niche for ${count} accounts to follow, like & engage...`);

    const KEYWORDS = [
      "founder personal brand",
      "building in public",
      "solopreneur automation",
      "AI tools for creators",
      "indiehacker",
      "personal brand tips",
      "indie founder growth",
    ];

    try {
      const me = await getMyProfile();
      const seen = new Set<string>();
      let followed = 0, liked = 0, replied = 0;

      for (const keyword of KEYWORDS) {
        if (followed >= count) break;
        const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 10);

        for (const tweet of tweets) {
          if (followed >= count) break;
          if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id)) continue;
          seen.add(tweet.author_id);

          try {
            // Follow
            await followUser(tweet.author_id, me.id);
            followed++;
            await randomDelay(800, 2000);

            // Like the tweet
            try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
            await randomDelay(500, 1500);

            // 40% chance: reply with AI-generated contextual comment
            if (Math.random() < 0.4) {
              try {
                const { generateReply } = await import("@/lib/claude/generate");
                const replyText = await generateReply(tweet.text, tweet.author_id);
                const item = await prisma.queueItem.create({
                  data: {
                    type: "Reply",
                    content: replyText,
                    metadata: { tweetId: tweet.id, original: tweet.text.slice(0, 100), source: "follow-engage" },
                  },
                });
                await import("@/lib/telegram/notify").then(m =>
                  m.requestApproval("Reply to new follow", replyText, { original: tweet.text.slice(0, 80), id: item.id })
                );
                replied++;
              } catch { /* skip */ }
              await randomDelay(2000, 4000);
            }
          } catch { /* already following or rate limited */ }
        }
      }

      await prisma.activity.create({
        data: { action: `Deep follow: ${followed} accounts`, detail: `Liked ${liked} · ${replied} replies queued`, icon: "🤝" },
      });

      await reply(chatId,
        `✅ Done!\n\n` +
        `👤 *Followed:* ${followed} accounts\n` +
        `❤️ *Liked:* ${liked} tweets\n` +
        `💬 *Replies queued:* ${replied} (check /queue to approve)\n\n` +
        `_All from your niche: founders, creators & solopreneurs._`
      );
    } catch (e) {
      await reply(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  return NextResponse.json({ ok: true });
}
