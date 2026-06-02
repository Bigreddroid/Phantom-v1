import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet, postTweetWithImage, postThread } from "@/lib/x/post";
import { searchTweets, followUser, getMyProfile, likeTweet } from "@/lib/x/engage";
import { generateTweet, generateThread, generateReply } from "@/lib/claude/generate";
import { notifyPosted } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";

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

const KEYWORDS = [
  "founder personal brand", "building in public", "solopreneur automation",
  "AI tools for creators", "indiehacker", "personal brand tips",
];

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
      `/post <text> — post your own tweet instantly\n\n` +
      `*Engagement*\n` +
      `/engage — run engagement (like/follow/reply)\n` +
      `/follow [n] — follow + like + reply to n accounts\n` +
      `/mentions — check & auto-reply to mentions\n\n` +
      `*Dashboard*\n` +
      `/status — live stats\n` +
      `/activity — last 10 actions\n` +
      `/schedule — automation schedule\n\n` +
      `*Control*\n` +
      `/pause — pause automation\n` +
      `/resume — resume automation\n\n` +
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
        `*X Account (@BigRedDr0id)*\n` +
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
      await send(chatId,
        `✅ *Engagement complete*\n\n` +
        `❤️ Liked: ${r.liked}\n` +
        `👤 Followed: ${r.followed}\n` +
        `💬 Replied: ${r.replied}\n` +
        `🎯 Topic: "${r.keyword}"\n` +
        `_10:1 verified:non-verified ratio applied_`
      );
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /follow [n] ───────────────────────────────────────────────────────────
  else if (cmd === "/follow") {
    const count = Math.min(parseInt(args || "5", 10) || 5, 15);
    await send(chatId, `🧠 Finding ${count} niche accounts to follow, like & engage...`);

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
            await followUser(tweet.author_id, me.id);
            followed++;
            await randomDelay(800, 2000);
          } catch { /* already following */ }

          try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
          await randomDelay(500, 1500);

          if (Math.random() < 0.4) {
            try {
              const replyText = await generateReply(tweet.text, tweet.author_id);
              const { replyToTweet: reply } = await import("@/lib/x/post");
              await reply(tweet.id, replyText);
              replied++;
              await prisma.activity.create({
                data: { action: "Replied to new follow", detail: replyText.slice(0, 80), icon: "💬" },
              });
              await randomDelay(2000, 4000);
            } catch { /* skip */ }
          }
        }
      }

      await prisma.activity.create({
        data: { action: `Follow+engage: ${followed} accounts`, detail: `Liked ${liked} · ${replied} replies`, icon: "🤝" },
      });

      await send(chatId,
        `✅ *Done!*\n\n` +
        `👤 Followed: *${followed}*\n` +
        `❤️ Liked: *${liked}*\n` +
        `💬 Replied: *${replied}*\n\n` +
        `_All from your niche: founders, creators & solopreneurs._`
      );
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
      if (r.mentions === 0) {
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
    await prisma.activity.create({ data: { action: "Automation paused", icon: "⏸️" } });
    await send(chatId, "⏸️ *Paused.*\n\nGitHub Actions will still run — to fully stop, disable the workflow at github.com.\n\nSend /resume to mark as active.");
  }

  // ── /resume ───────────────────────────────────────────────────────────────
  else if (cmd === "/resume") {
    await prisma.activity.create({ data: { action: "Automation resumed", icon: "▶️" } });
    await send(chatId, "▶️ *Resumed.* Phantom is back on autopilot.");
  }

  return NextResponse.json({ ok: true });
}
