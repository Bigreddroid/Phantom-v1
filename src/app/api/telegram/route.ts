import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet, postTweetWithImage, postThread } from "@/lib/x/post";
import { generateTweet, generateThread, generateDM } from "@/lib/claude/generate";
import { notifyPosted } from "@/lib/telegram/notify";
import { ensureWebhook, ensureCommands } from "@/lib/telegram/setup";
import { xRO } from "@/lib/x/client";
import { sendDM, getDMConversations } from "@/lib/x/dm";
import { searchTweets, getMyProfile } from "@/lib/x/engage";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT = process.env.TELEGRAM_CHAT_ID!;
const APP = process.env.NEXTAUTH_URL!;

async function send(chatId: string, text: string, extra?: object) {
  await fetch(`${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
  });
}

async function answerCallback(id: string) {
  await fetch(`${BOT}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id }),
  });
}

import { NICHE_KEYWORDS } from "@/lib/config";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Inline button callbacks ──────────────────────────────────────────────
  if (body.callback_query) {
    const { data, from, id: cbId } = body.callback_query;
    const chatId = String(from.id);
    if (chatId !== CHAT) return NextResponse.json({ ok: true });

    await answerCallback(cbId);

    const [action, param] = data.split(":");

    if (action === "tweet_plain") {
      await send(chatId, "⚙️ Generating & posting tweet...");
      try {
        const res = await fetch(`${APP}/api/jobs/tweet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: false }) });
        const r = await res.json();
        await send(chatId, `✅ *Posted*\n\n${r.content}`);
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    if (action === "tweet_image") {
      await send(chatId, "🖼️ Generating tweet with image...");
      try {
        const res = await fetch(`${APP}/api/jobs/tweet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: true }) });
        const r = await res.json();
        await send(chatId, `✅ *Posted ${r.hasImage ? "with image" : "(text-only fallback)"}*\n\n${r.content}`);
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    if (action === "thread_post") {
      await send(chatId, "🧵 Generating & posting thread...");
      try {
        await fetch(`${APP}/api/jobs/thread`, { method: "POST" });
        await send(chatId, `✅ Thread posted — check your X profile.`);
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    return NextResponse.json({ ok: true });
  }

  // ── Text commands ────────────────────────────────────────────────────────
  const msg = body.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = String(msg.chat.id);
  if (chatId !== CHAT) return NextResponse.json({ ok: true });

  const raw = msg.text.trim();
  const cmd = raw.toLowerCase().split(" ")[0];
  const args = raw.slice(cmd.length).trim();

  // ── /start | /help ───────────────────────────────────────────────────────
  if (cmd === "/start" || cmd === "/help") {
    await send(chatId,
      `*🤖 Phantom — AI Brand Secretary*\n\n` +
      `Everything runs automatically. Use these to control it:\n\n` +
      `*Content*\n` +
      `/tweet — generate & post tweet now\n` +
      `/thread — generate & post thread now\n` +
      `/post <text> — post your own tweet instantly\n` +
      `/dm @username [context] — send a personalised cold DM\n\n` +
      `*Engagement*\n` +
      `/engage — run engagement (like + reply, 10:1 ratio)\n` +
      `/goout — drop comments on 5 tweets (human mode)\n` +
      `/follow [n] — follow + like + reply to n accounts\n` +
      `/mentions — check & auto-reply to mentions\n\n` +
      `*Dashboard*\n` +
      `/status — live stats\n` +
      `/activity — last 10 actions\n` +
      `/schedule — automation schedule\n\n` +
      `*Control*\n` +
      `/pause — pause automation\n` +
      `/resume — resume automation\n` +
      `/blacklist <username> — silently ignore an account\n` +
      `/setup — register webhook & command menu\n` +
      `/test — test X API connectivity\n\n` +
      `_Phantom posts autonomously. You'll get notified after every action._`
    );
  }

  // ── /status ──────────────────────────────────────────────────────────────
  else if (cmd === "/status") {
    try {
      const [statsRes, recentActivity, totalPosted, totalReplied] = await Promise.all([
        fetch(`${APP}/api/stats`).then(r => r.json()).catch(() => ({})),
        prisma.activity.findMany({ orderBy: { createdAt: "desc" }, take: 3 }),
        prisma.activity.count({ where: { icon: { in: ["🐦", "🧵", "🖼️"] } } }),
        prisma.activity.count({ where: { icon: "💬" } }),
      ]);

      const lastAct = recentActivity[0];
      const lastTime = lastAct
        ? new Date(lastAct.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
        : "—";

      await send(chatId,
        `*📊 Phantom Dashboard*\n\n` +
        `*X Account (${process.env.X_HANDLE ?? "@yourusername"})*\n` +
        `👥 Followers: ${statsRes.followers ?? "—"}\n` +
        `👤 Following: ${statsRes.following ?? "—"}\n` +
        `🐦 Tweets: ${statsRes.tweets ?? "—"}\n\n` +
        `*Automation Stats*\n` +
        `📮 Posts sent: ${totalPosted}\n` +
        `💬 Replies sent: ${totalReplied}\n` +
        `⚡ Engagements: ${statsRes.engagements ?? "—"}\n\n` +
        `*Last action:* ${lastAct ? `${lastAct.icon} ${lastAct.action}` : "None"} at ${lastTime}\n\n` +
        `_All systems running on autopilot._`
      );
    } catch (e) {
      await send(chatId, `❌ Error fetching status: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /activity ─────────────────────────────────────────────────────────────
  else if (cmd === "/activity") {
    const items = await prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (!items.length) {
      await send(chatId, "No activity yet.");
    } else {
      const lines = items.map(a => {
        const t = new Date(a.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
        });
        return `${a.icon ?? "•"} *${a.action}* (${t})\n   ${a.detail ?? ""}`;
      });
      await send(chatId, `*📋 Recent Activity*\n\n${lines.join("\n\n")}`);
    }
  }

  // ── /tweet ────────────────────────────────────────────────────────────────
  else if (cmd === "/tweet") {
    await send(chatId,
      `*Post a tweet:*`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "📝 Text only", callback_data: "tweet_plain:" },
            { text: "🖼️ With image", callback_data: "tweet_image:" },
          ]],
        },
      }
    );
  }

  // ── /thread ───────────────────────────────────────────────────────────────
  else if (cmd === "/thread") {
    await send(chatId,
      `*Post a thread?*`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "🧵 Post 5-tweet thread", callback_data: "thread_post:" },
          ]],
        },
      }
    );
  }

  // ── /post <custom text> ───────────────────────────────────────────────────
  else if (cmd === "/post") {
    if (!args) {
      await send(chatId, "Usage: `/post Your tweet text here`");
    } else {
      await send(chatId, "⚡ Posting now...");
      try {
        const result = await postTweet(args);
        await prisma.activity.create({
          data: { action: "Manual tweet posted", detail: args.slice(0, 80), icon: "🐦" },
        });
        await send(chatId, `✅ *Posted!*\n\n${args}`);
        void notifyPosted("Manual tweet", args);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
    }
  }

  // ── /engage ───────────────────────────────────────────────────────────────
  else if (cmd === "/engage") {
    await send(chatId, "⚡ Running engagement (10:1 verified ratio)...");
    try {
      const res = await fetch(`${APP}/api/jobs/engage`, { method: "POST" });
      const r = await res.json();
      if (!res.ok || r.error) {
        await send(chatId, `❌ Engagement failed: ${r.error ?? "Unknown error"}`);
      } else {
        const commentLines = (r.comments ?? []).map(
          (c: { original: string; reply: string }) =>
            `_"${c.original}"_\n↩ ${c.reply}`
        ).join("\n\n");
        const errorNote = r.errors?.length
          ? `\n\n⚠️ _${r.errors.length} failed: ${r.errors[0]}_`
          : "";
        await send(chatId,
          `✅ *Engagement done* — ❤️ ${r.liked} likes · 💬 ${r.replied} comments\n` +
          `🎯 Topic: "${r.keyword}"\n\n` +
          (commentLines || "_No replies this run._") +
          errorNote
        );
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /goout ────────────────────────────────────────────────────────────────
  else if (cmd === "/goout") {
    await send(chatId, "🗣️ Going out to drop some comments...");
    try {
      const res = await fetch(`${APP}/api/jobs/goout`, { method: "POST" });
      const r = await res.json();
      if (!res.ok || r.error) {
        await send(chatId, `❌ Go-out failed: ${r.error ?? "Unknown error"}`);
      } else {
        const lines = (r.comments ?? []).map(
          (c: { original: string; reply: string }) =>
            `_"${c.original}"_\n↩ ${c.reply}`
        ).join("\n\n");
        const errorNote = r.errors?.length
          ? `\n\n⚠️ _${r.errors.length} failed: ${r.errors[0]}_`
          : "";
        await send(chatId,
          `✅ *Dropped ${r.comments?.length ?? 0} comments*\n` +
          `🎯 Topic: "${r.keyword}"\n\n` +
          (lines || "_Nothing to comment on this run._") +
          errorNote
        );
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /follow [n] ───────────────────────────────────────────────────────────
  else if (cmd === "/follow") {
    const count = Math.min(parseInt(args || "5", 10) || 5, 20);
    await send(chatId, `🤝 Following ${count} niche accounts (like + reply included)...`);
    try {
      const res = await fetch(`${APP}/api/jobs/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const r = await res.json();
      if (!res.ok || r.error) {
        await send(chatId, `❌ Follow failed: ${r.error ?? "Unknown error"}`);
      } else {
        await send(chatId,
          `✅ *Follow run done*\n\n` +
          `👤 Followed: *${r.followed}*\n` +
          `❤️ Liked: *${r.liked}*\n` +
          `💬 Replied: *${r.replied}*\n\n` +
          `_Each reply also sent to this chat._`
        );
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /mentions ─────────────────────────────────────────────────────────────
  else if (cmd === "/mentions") {
    await send(chatId, "🔍 Checking & replying to mentions...");
    try {
      const res = await fetch(`${APP}/api/jobs/mentions`, { method: "POST" });
      const r = await res.json();
      if (!res.ok || r.error) {
        await send(chatId, `❌ Mentions failed: ${r.error ?? "Unknown error"}`);
      } else if (r.mentions === 0) {
        await send(chatId, "✅ No new mentions.");
      } else {
        await send(chatId, `✅ Auto-replied to *${r.mentions}* mention${r.mentions > 1 ? "s" : ""}.`);
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /schedule ─────────────────────────────────────────────────────────────
  else if (cmd === "/schedule") {
    await send(chatId,
      `*⏰ Automation Schedule (IST)*\n\n` +
      `🐦 *Tweets* — 7:30am · 12:30pm · 6:30pm\n` +
      `   _3x/day · 30% chance of branded image · 15% skip_\n\n` +
      `🧵 *Threads* — Mon & Thu 2:30pm\n` +
      `   _5 tweets · 20% skip chance_\n\n` +
      `⚡ *Engagement* — Every 2h (7am–10pm)\n` +
      `   _Like + follow + reply · 10:1 verified ratio_\n\n` +
      `💬 *Mentions* — Every 30 minutes\n` +
      `   _Auto-reply instantly_\n\n` +
      `📊 *Daily summary* — 11:30pm\n` +
      `   _Full Telegram report_\n\n` +
      `_All running via GitHub Actions. Zero approval needed._`
    );
  }

  // ── /pause ────────────────────────────────────────────────────────────────
  else if (cmd === "/pause") {
    await prisma.stats.upsert({
      where: { id: "singleton" },
      update: { paused: true },
      create: { paused: true },
    });
    await prisma.activity.create({ data: { action: "Automation paused", icon: "⏸️" } });
    await send(chatId, "⏸️ *Paused.* All cron jobs will skip until you /resume.\n\n_(GitHub Actions still fires but Phantom does nothing.)_");
  }

  // ── /resume ───────────────────────────────────────────────────────────────
  else if (cmd === "/resume") {
    await prisma.stats.upsert({
      where: { id: "singleton" },
      update: { paused: false },
      create: { paused: false },
    });
    await prisma.activity.create({ data: { action: "Automation resumed", icon: "▶️" } });
    await send(chatId, "▶️ *Resumed.* Phantom is back on autopilot.");
  }

  // ── /test ────────────────────────────────────────────────────────────────
  else if (cmd === "/test") {
    await send(chatId, "🔍 Running API diagnostics...");
    const lines: string[] = [];

    try {
      const me = await getMyProfile();
      lines.push(`✅ *Auth* — @${(me as unknown as Record<string, unknown>).username ?? me.id}`);
    } catch (e) {
      lines.push(`❌ *Auth* — ${String(e).slice(0, 80)}`);
    }

    try {
      const tweets = await searchTweets("AI -is:retweet lang:en", 5);
      lines.push(`✅ *Search* — ${tweets.length} results`);
    } catch (e) {
      lines.push(`❌ *Search* — ${String(e).slice(0, 80)}`);
    }

    try {
      await getDMConversations();
      lines.push(`✅ *DM API*`);
    } catch (e) {
      lines.push(`❌ *DM API* — ${String(e).slice(0, 80)}`);
    }

    await send(chatId, `*🔍 Diagnostics*\n\n${lines.join("\n")}`);
  }

  // ── /setup ────────────────────────────────────────────────────────────────
  else if (cmd === "/setup") {
    await send(chatId, "⚙️ Registering webhook and command menu...");
    try {
      const [webhook, commands] = await Promise.all([ensureWebhook(), ensureCommands()]);
      await send(chatId,
        `*🔧 Setup*\n\n` +
        `Webhook: ${webhook ? "✅ OK" : "❌ Failed"}\n` +
        `Commands: ${commands ? "✅ OK" : "❌ Failed"}`
      );
    } catch (e) {
      await send(chatId, `❌ Setup error: ${String(e).slice(0, 120)}`);
    }
  }

  // ── /dm <username> [context] ──────────────────────────────────────────────
  else if (cmd === "/dm") {
    const parts = args.split(" ");
    const username = parts[0]?.replace("@", "").trim();
    const context = parts.slice(1).join(" ").trim();

    if (!username) {
      await send(chatId, "Usage: `/dm @username [optional context about them]`\n\nPhantom will auto-generate a personalised DM.");
    } else {
      await send(chatId, `✉️ Sending DM to @${username}...`);
      try {
        const { data: user } = await xRO.v2.userByUsername(username);
        if (!user) throw new Error(`@${username} not found`);
        const dmText = await generateDM(username, context || `a creator in the ${NICHE_KEYWORDS[0]} space`);
        await sendDM(user.id, dmText);
        await prisma.activity.create({
          data: { action: `DM sent to @${username}`, detail: dmText.slice(0, 80), icon: "✉️" },
        });
        await send(chatId, `✅ *DM sent to @${username}*\n\n_"${dmText}"_`);
      } catch (e) {
        await send(chatId, `❌ DM failed: ${String(e).slice(0, 150)}`);
      }
    }
  }

  // ── /blacklist <username> | /block <username> ────────────────────────────
  else if (cmd === "/blacklist" || cmd === "/block") {
    if (!args) {
      await send(chatId,
        `Usage: \`/blacklist username\`\n\n` +
        `Phantom will silently skip that account — no Twitter block, no DM. They'll never know.\n\n` +
        `Takes effect immediately (stored in DB).`
      );
    } else {
      const username = args.replace("@", "").trim().toLowerCase();
      await prisma.blockedAccount.upsert({
        where: { username },
        update: {},
        create: { username },
      });
      await prisma.activity.create({
        data: { action: `Blacklisted: @${username}`, detail: "Active immediately", icon: "🚫" },
      });
      await send(chatId,
        `🚫 *Blocked: @${username}*\n\nActive immediately — Phantom will silently skip this account.\n\nNo Twitter block is made — they can still see your profile.`
      );
    }
  }

  return NextResponse.json({ ok: true });
}
