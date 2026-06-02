import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet, postThread } from "@/lib/x/post";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";

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

  return NextResponse.json({ ok: true });
}
