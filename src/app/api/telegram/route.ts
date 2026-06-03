import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet, postTweetWithImage, postThread, quoteTweet } from "@/lib/x/post";
import { generateTweet, generateThread, generateDM, generateQuoteTweet, generateLinkedInPost } from "@/lib/claude/generate";
import { notifyPosted, requestApproval, sendMessage } from "@/lib/telegram/notify";
import { ensureWebhook, ensureCommands } from "@/lib/telegram/setup";
import { xRO } from "@/lib/x/client";
import { sendDM, getDMConversations } from "@/lib/x/dm";
import { searchTweets, getMyProfile, retweet, getMyTweets } from "@/lib/x/engage";
import { getLinkedInAuth } from "@/lib/linkedin/client";
import { postToLinkedIn } from "@/lib/linkedin/post";
import { CONTENT_TOPICS, THREAD_TOPICS } from "@/lib/config";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT = process.env.TELEGRAM_CHAT_ID!;
const APP = process.env.NEXTAUTH_URL!;

// Internal job fetches must carry CRON_SECRET so middleware allows them through
function cronFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
    "Authorization": `Bearer ${process.env.CRON_SECRET}`,
  };
  return fetch(`${APP}${path}`, { ...options, headers });
}

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

// ── Shared: post an approved queue item ──────────────────────────────────────
async function postQueueItem(item: { id: string; type: string; content: string; metadata: unknown }) {
  const meta = (item.metadata as Record<string, unknown>) ?? {};
  if (item.type === "Thread") {
    const tweets = item.content.split("---").map((t: string) => t.trim()).filter(Boolean);
    const imageMode = (["none", "first", "all"].includes(meta.imageMode as string)
      ? meta.imageMode
      : "none") as "none" | "first" | "all";
    await postThread(tweets, imageMode);
  } else {
    if (meta.withImage) {
      await postTweetWithImage(item.content);
    } else {
      await postTweet(item.content);
    }
  }
  await prisma.queueItem.update({ where: { id: item.id }, data: { status: "POSTED" } });
  await prisma.activity.create({
    data: { action: `${item.type} approved & posted`, detail: item.content.slice(0, 250), icon: "✅" },
  });
}

export async function POST(req: NextRequest) {
  // Verify Telegram webhook secret token (set via TELEGRAM_WEBHOOK_SECRET + setWebhook secret_token)
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (incoming !== webhookSecret) {
      return NextResponse.json({ ok: true }); // silent 200 — don't reveal endpoint existence
    }
  }

  const body = await req.json();

  // ── Inline button callbacks ──────────────────────────────────────────────
  if (body.callback_query) {
    const { data, from, id: cbId } = body.callback_query;
    const chatId = String(from.id);
    if (chatId !== CHAT) return NextResponse.json({ ok: true });

    await answerCallback(cbId);

    const colonIdx = data.indexOf(":");
    const action = data.slice(0, colonIdx);
    const param = data.slice(colonIdx + 1);

    // ── Approval flow callbacks ──────────────────────────────────────────────
    if (action === "approve") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      await send(chatId, "⚡ Posting now...");
      try {
        await postQueueItem(item);
        await send(chatId, `✅ *Posted!*\n\n${item.content.slice(0, 280)}`);
      } catch (e) {
        await send(chatId, `❌ Post failed: ${String(e).slice(0, 120)}`);
      }
    }

    if (action === "reject") {
      await prisma.queueItem.update({ where: { id: param }, data: { status: "REJECTED" } });
      await send(chatId, "🗑️ *Rejected.* Content discarded.");
    }

    if (action === "edit") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      const existingMeta = (item.metadata as Record<string, unknown>) ?? {};
      await prisma.queueItem.update({
        where: { id: param },
        data: { metadata: { ...existingMeta, awaitingEdit: true } },
      });
      await send(chatId,
        `✏️ *Edit mode* — reply with your version:\n\n\`\`\`\n${item.content.slice(0, 600)}\n\`\`\``,
        { reply_markup: { force_reply: true, selective: true } }
      );
    }

    // ── Auto DM approval ─────────────────────────────────────────────────────
    if (action === "approve_dm") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      const meta = (item.metadata as Record<string, unknown>) ?? {};
      await send(chatId, `✉️ Sending DM to @${meta.targetUsername}...`);
      try {
        const { xRO } = await import("@/lib/x/client");
        const { sendDM: xSendDM } = await import("@/lib/x/dm");
        const { data: user } = await xRO.v2.userByUsername(String(meta.targetUsername));
        if (!user) throw new Error(`@${meta.targetUsername} not found`);
        await xSendDM(user.id, item.content);
        await prisma.queueItem.update({ where: { id: param }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: `Auto DM sent to @${meta.targetUsername}`, detail: item.content.slice(0, 80), icon: "✉️" },
        });
        await send(chatId, `✅ *DM sent to @${meta.targetUsername}!*\n\n_"${item.content}"_`);
      } catch (e) {
        await send(chatId, `❌ DM failed: ${String(e).slice(0, 120)}`);
      }
    }

    // ── Cross-post: X + LinkedIn ──────────────────────────────────────────────
    if (action === "approve_xl") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      await send(chatId, "⚡ Posting to X + LinkedIn...");
      try {
        await postQueueItem(item);
        await send(chatId, `✅ *Posted to X!*\n\n${item.content.slice(0, 280)}`);

        // Generate adapted LinkedIn version and post
        const liContent = await generateLinkedInPost(item.content);
        await postToLinkedIn(liContent);
        await prisma.activity.create({
          data: { action: "Cross-posted to LinkedIn", detail: liContent.slice(0, 80), icon: "💼" },
        });
        await send(chatId, `✅ *Also posted to LinkedIn!*\n\n${liContent.slice(0, 300)}`);
      } catch (e) {
        await send(chatId, `❌ Cross-post error: ${String(e).slice(0, 150)}`);
      }
    }

    // ── Resurface: quote-tweet old content ────────────────────────────────────
    if (action === "resurface") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      await send(chatId, "🔁 Generating quote-tweet...");
      try {
        const meta = (item.metadata as Record<string, unknown>) ?? {};
        const tweetId = meta.tweetId as string;
        const comment = await generateQuoteTweet(item.content);
        await quoteTweet(tweetId, comment);
        await prisma.queueItem.update({ where: { id: param }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: "Resurfaced old tweet", detail: comment.slice(0, 80), icon: "🔁" },
        });
        await send(chatId, `✅ *Quote-tweeted!*\n\n_"${comment}"_`);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
    }

    // ── Niche RT callbacks ────────────────────────────────────────────────────
    if (action === "niche_rt") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      await send(chatId, "🔁 Retweeting...");
      try {
        const meta = (item.metadata as Record<string, unknown>) ?? {};
        const me = await getMyProfile();
        await retweet(meta.tweetId as string, me.id);
        await prisma.queueItem.update({ where: { id: param }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: `Retweeted @${meta.authorUsername ?? "niche account"}`, detail: item.content.slice(0, 80), icon: "🔁" },
        });
        await send(chatId, `✅ *Retweeted @${meta.authorUsername ?? "them"}!*`);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
    }

    if (action === "niche_quote") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      await send(chatId, "💬 Generating quote-tweet...");
      try {
        const meta = (item.metadata as Record<string, unknown>) ?? {};
        const comment = await generateQuoteTweet(item.content);
        await quoteTweet(meta.tweetId as string, comment);
        await prisma.queueItem.update({ where: { id: param }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: `Quote-tweeted @${meta.authorUsername ?? "niche account"}`, detail: comment.slice(0, 80), icon: "💬" },
        });
        await send(chatId, `✅ *Quote-tweeted!*\n\n_"${comment}"_`);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
    }

    // ── Tweet preview callbacks (approval-gated) ─────────────────────────────
    if (action === "tweet_plain") {
      await send(chatId, "✍️ Generating preview...");
      try {
        const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
        const content = await generateTweet(pillar);
        const item = await prisma.queueItem.create({
          data: { type: "Tweet", content, metadata: { withImage: false } },
        });
        await requestApproval("Tweet", content, { id: item.id });
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    if (action === "tweet_image") {
      await send(chatId, "✍️ Generating preview...");
      try {
        const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
        const content = await generateTweet(pillar);
        const item = await prisma.queueItem.create({
          data: { type: "Tweet", content, metadata: { withImage: true } },
        });
        await requestApproval("Tweet + branded image", content, { id: item.id });
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    if (action === "tweet_image_only") {
      await send(chatId, "🎨 Generating branded image post...");
      try {
        const content = await generateTweet(
          "a punchy one-liner tagline or quote about personal branding, AI automation, or building in public — max 80 characters, no hashtags, no generic opener"
        );
        const item = await prisma.queueItem.create({
          data: { type: "Tweet", content, metadata: { withImage: true, imageOnly: true } },
        });
        await requestApproval("Image-only tweet (branded card)", content, { id: item.id });
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    if (action === "thread_plain") {
      await send(chatId, "✍️ Generating thread preview...");
      try {
        const pillar = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
        const tweets = await generateThread(pillar);
        const content = tweets.join("\n---\n");
        const item = await prisma.queueItem.create({
          data: { type: "Thread", content, metadata: { imageMode: "none" } },
        });
        await requestApproval(
          `Thread — ${tweets.length} tweets`,
          `*${pillar}*\n\n${tweets[0]}\n\n[+ ${tweets.length - 1} more tweets]`,
          { id: item.id }
        );
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    if (action === "thread_img_first") {
      await send(chatId, "✍️ Generating thread preview...");
      try {
        const pillar = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
        const tweets = await generateThread(pillar);
        const content = tweets.join("\n---\n");
        const item = await prisma.queueItem.create({
          data: { type: "Thread", content, metadata: { imageMode: "first" } },
        });
        await requestApproval(
          `Thread — ${tweets.length} tweets · image on #1`,
          `*${pillar}*\n\n${tweets[0]}\n\n[+ ${tweets.length - 1} more tweets]`,
          { id: item.id }
        );
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    if (action === "thread_img_all") {
      await send(chatId, "✍️ Generating thread preview...");
      try {
        const pillar = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
        const tweets = await generateThread(pillar);
        const content = tweets.join("\n---\n");
        const item = await prisma.queueItem.create({
          data: { type: "Thread", content, metadata: { imageMode: "all" } },
        });
        await requestApproval(
          `Thread — ${tweets.length} tweets · image on all`,
          `*${pillar}*\n\n${tweets[0]}\n\n[+ ${tweets.length - 1} more tweets]`,
          { id: item.id }
        );
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    // ── LinkedIn callbacks ──────────────────────────────────────────────────
    if (action === "li_post") {
      await send(chatId, "💼 Generating & publishing LinkedIn post...");
      try {
        const res = await cronFetch(`/api/jobs/linkedin`, { method: "POST" });
        const r = await res.json();
        if (r.error) throw new Error(r.error);
        await send(chatId, `✅ *LinkedIn post published*\n\n${(r.content as string)?.slice(0, 500) ?? ""}`);
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 200)}`); }
    }

    if (action === "li_story") {
      await send(chatId, "📖 Writing LinkedIn story post (draws from recent X content)...");
      try {
        const res = await cronFetch(`/api/jobs/linkedin-story`, { method: "POST" });
        const r = await res.json();
        if (r.error) throw new Error(r.error);
        await send(chatId, `✅ *LinkedIn story published*\n\n${(r.content as string)?.slice(0, 500) ?? ""}`);
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 200)}`); }
    }

    if (action === "li_list") {
      await send(chatId, "📋 Writing LinkedIn 5-lesson list post...");
      try {
        const res = await cronFetch(`/api/jobs/linkedin-list`, { method: "POST" });
        const r = await res.json();
        if (r.error) throw new Error(r.error);
        await send(chatId, `✅ *LinkedIn list published*\n\n${(r.content as string)?.slice(0, 500) ?? ""}`);
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 200)}`); }
    }

    if (action === "li_connect") {
      await send(chatId,
        `🔗 *Connect LinkedIn*\n\n` +
        `Open this link in your browser to authorize Phantom:\n\n` +
        `${APP}/api/auth/linkedin\n\n` +
        `_One-time setup. Token lasts 60 days — you'll be reminded when it expires._`
      );
    }

    if (action === "li_status") {
      const liAuth = await getLinkedInAuth();
      if (!liAuth) {
        await send(chatId,
          `❌ *LinkedIn not connected*\n\nUse \`/linkedin\` → Connect account to authorize.\n\n` +
          `You need \`LINKEDIN_CLIENT_ID\` and \`LINKEDIN_CLIENT_SECRET\` set in your env vars first.`
        );
      } else {
        const daysLeft = Math.floor((liAuth.expiresAt.getTime() - Date.now()) / 86400000);
        const expired = daysLeft <= 0;
        await send(chatId,
          `${expired ? "⚠️ *LinkedIn token expired*" : `✅ *LinkedIn connected*`}\n\n` +
          `Person ID: \`${liAuth.personId}\`\n` +
          `Token ${expired ? "expired" : `expires in *${daysLeft} days*`}\n\n` +
          `${expired ? "Reconnect via /linkedin → Connect account." : "Posts are running on schedule."}`
        );
      }
    }

    // ── Mention reply callbacks ───────────────────────────────────────────────
    if (action === "reply_mention") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Mention already handled.");
        return NextResponse.json({ ok: true });
      }
      await send(chatId, "💬 Generating reply...");
      try {
        const meta = (item.metadata as Record<string, unknown>) ?? {};
        const reply = await generateReply(item.content, String(meta.authorUsername || "user"));
        await replyToTweet(String(meta.tweetId), reply);
        await prisma.queueItem.update({ where: { id: param }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: "Replied to mention", detail: `mid:${meta.tweetId}|${reply.slice(0, 70)}`, icon: "💬" },
        });
        await send(chatId,
          `✅ *Reply sent!*\n\n` +
          `_They said:_ "${item.content.slice(0, 150)}"\n\n` +
          `↩ ${reply}`
        );
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
    }

    if (action === "custom_mention") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Mention already handled.");
        return NextResponse.json({ ok: true });
      }
      const existingMeta = (item.metadata as Record<string, unknown>) ?? {};
      await prisma.queueItem.update({
        where: { id: param },
        data: { metadata: { ...existingMeta, awaitingMentionReply: true } },
      });
      await send(chatId,
        `✏️ *Type your reply to @${existingMeta.authorUsername || "them"}:*\n\n_"${item.content.slice(0, 200)}"_`,
        { reply_markup: { force_reply: true, selective: true } }
      );
    }

    if (action === "skip_mention") {
      await prisma.queueItem.updateMany({
        where: { id: param, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      await send(chatId, "⏭️ Skipped.");
    }

    if (action === "dm_send") {
      await send(chatId,
        `📨 *Send a DM*\n\nReply with this format:\n\n` +
        "`/dm @username [optional context about them]`\n\n" +
        `Examples:\n` +
        "`/dm @johndoe`\n" +
        "`/dm @janefoo she builds SaaS tools and tweets about growth`\n\n" +
        `_Phantom generates a personalised cold DM and sends it via X._`
      );
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
      `*𝕏 Content*\n` +
      `/tweet — preview tweet before posting\n` +
      `/thread — preview thread before posting\n` +
      `/post <text> — post your own tweet instantly\n\n` +
      `*LinkedIn*\n` +
      `/linkedin — post, connect, or check status\n\n` +
      `*Reposts*\n` +
      `/resurface — quote-tweet one of your old posts\n` +
      `/rt [keyword] — retweet or quote a niche post\n` +
      `/blast <text> — post same text to X + LinkedIn now\n\n` +
      `*Engagement & Outreach*\n` +
      `/engage — run engagement (like + reply, 10:1 ratio)\n` +
      `/topic <keyword> — engage on a specific topic\n` +
      `/goout — drop comments on 5 tweets (human mode)\n` +
      `/follow [n] — follow + like + reply to n accounts\n` +
      `/inbox — see unread mentions, reply or skip each one\n` +
      `/mentions — auto-reply to all mentions instantly\n` +
      `/dm @username [context] — send a personalised cold DM\n\n` +
      `*Dashboard*\n` +
      `/status — live stats (both platforms)\n` +
      `/activity — last 10 actions\n` +
      `/queue — view pending approvals\n` +
      `/schedule — automation schedule\n\n` +
      `*Control*\n` +
      `/pause — pause all automation\n` +
      `/resume — resume automation\n` +
      `/blacklist <username> — silently ignore an account\n` +
      `/setup — register webhook & command menu\n` +
      `/test — test X API connectivity\n\n` +
      `_All scheduled posts send a preview here first. Tap Approve to post._`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📨 Send DM",      callback_data: "dm_send:"  },
              { text: "💼 LI Post",      callback_data: "li_post:"  },
              { text: "📖 LI Story",     callback_data: "li_story:" },
              { text: "📋 LI 5 Lessons", callback_data: "li_list:"  },
            ],
          ],
        },
      }
    );
  }

  // ── /status ──────────────────────────────────────────────────────────────
  else if (cmd === "/status") {
    try {
      const [statsRes, recentActivity, totalPosted, totalReplied] = await Promise.all([
        cronFetch(`/api/stats`).then(r => r.json()).catch(() => ({})),
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
      `*Preview a tweet before posting:*`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "📝 Text only",   callback_data: "tweet_plain:" },
            { text: "🖼️ With image",  callback_data: "tweet_image:" },
            { text: "🎨 Image only",  callback_data: "tweet_image_only:" },
          ]],
        },
      }
    );
  }

  // ── /thread ───────────────────────────────────────────────────────────────
  else if (cmd === "/thread") {
    await send(chatId,
      `*Post a 5-tweet thread:*`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🖊️ Text only",        callback_data: "thread_plain:" },
              { text: "🖼️ Image on tweet #1", callback_data: "thread_img_first:" },
            ],
            [
              { text: "🖼️🖼️ Image on all 5 tweets", callback_data: "thread_img_all:" },
            ],
          ],
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
      const res = await cronFetch(`/api/jobs/engage`, { method: "POST" });
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
      const res = await cronFetch(`/api/jobs/goout`, { method: "POST" });
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
      const res = await cronFetch(`/api/jobs/follow`, {
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
      const res = await cronFetch(`/api/jobs/mentions`, { method: "POST" });
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
      `🐦 *Tweets* — 7:30am · 12:30pm · 6:30pm · 9:30pm\n` +
      `   _4x/day · randomly: plain, image, thread, or resurface · 15% skip_\n\n` +
      `🧵 *Bonus threads* — Mon & Thu 2:30pm\n` +
      `   _On top of the daily posting slot_\n\n` +
      `⚡ *Engagement* — Every 15 min, 24/7\n` +
      `   _Likes all day, replies 7am–10pm · 10:1 verified ratio_\n\n` +
      `🗣️ *Go-out comments* — 9am · 11am · 2pm · 5pm · 8pm\n` +
      `   _Drops targeted comments on niche posts_\n\n` +
      `💬 *Mentions* — Every 15 min\n` +
      `   _Auto-reply to mentions_\n\n` +
      `🤝 *Follow* — 9:30am · 3:30pm · 8:30pm\n\n` +
      `💼 *LinkedIn* — Tue–Fri 8:30am\n` +
      `   _Randomly: thought leadership, story, or list_\n\n` +
      `📊 *Daily summary* — 11:30pm\n\n` +
      `_Runs via cron-job.org → NEXTAUTH_URL/api/cron/dispatch_`
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

    // Auth
    let meId = "";
    try {
      const me = await getMyProfile();
      meId = me.id;
      lines.push(`✅ *Auth* — @${(me as unknown as Record<string, unknown>).username ?? me.id}`);
    } catch (e) {
      lines.push(`❌ *Auth* — ${String(e).slice(0, 80)}`);
    }

    // Search (read)
    let testTweet: { id: string } | null = null;
    try {
      const tweets = await searchTweets("building in public -is:retweet lang:en", 5);
      testTweet = tweets[0] ?? null;
      lines.push(`✅ *Search (read)* — ${tweets.length} results`);
    } catch (e) {
      lines.push(`❌ *Search (read)* — ${String(e).slice(0, 80)}`);
    }

    // Like a tweet (write test — non-destructive)
    if (testTweet && meId) {
      try {
        const { likeTweet } = await import("@/lib/x/engage");
        await likeTweet(testTweet.id, meId);
        lines.push(`✅ *Write (like)* — OK · replies & tweets should work`);
      } catch (e) {
        const err = String(e);
        const hint = err.includes("403")
          ? "\n→ *Fix:* Go to developer.x.com → your app → User auth → set Read+Write → *regenerate your Access Tokens*"
          : err.includes("429")
          ? "\n→ Rate limit — wait 15 min and try again"
          : "";
        lines.push(`❌ *Write (like)* — ${err.slice(0, 80)}${hint}`);
      }
    }

    // DM API
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

  // ── /linkedin ──────────────────────────────────────────────────────────────
  else if (cmd === "/linkedin") {
    await send(chatId,
      `*💼 LinkedIn — Pick a post type:*\n\n` +
      `*Post* — thought leadership on your niche\n` +
      `*Story* — personal narrative drawn from recent X content\n` +
      `*5 Lessons* — numbered list format (high engagement)\n`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💼 Post",      callback_data: "li_post:"  },
              { text: "📖 Story",     callback_data: "li_story:" },
              { text: "📋 5 Lessons", callback_data: "li_list:"  },
            ],
            [
              { text: "📊 Status",         callback_data: "li_status:"  },
              { text: "🔗 Connect account", callback_data: "li_connect:" },
            ],
          ],
        },
      }
    );
  }

  // ── /dm <username> [context] ──────────────────────────────────────────────
  else if (cmd === "/dm") {
    const parts = args.split(" ");
    const username = parts[0]?.replace("@", "").trim();
    const context = parts.slice(1).join(" ").trim();

    if (!username) {
      await send(chatId,
        `📨 *Send a DM*\n\nUsage: \`/dm @username [optional context]\`\n\n` +
        `Phantom will generate a personalised cold DM and send it.\n\n` +
        `Examples:\n` +
        "`/dm @johndoe`\n" +
        "`/dm @janefoo she builds SaaS tools and tweets about growth`"
      );
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

  // ── /resurface ───────────────────────────────────────────────────────────
  else if (cmd === "/resurface") {
    await send(chatId, "🔍 Finding an old tweet to resurface...");
    try {
      const res = await cronFetch(`/api/jobs/resurface`, { method: "POST" });
      const r = await res.json();
      if (!res.ok || r.error) {
        await send(chatId, `❌ ${r.error ?? r.reason ?? "No old tweets found."}`);
      } else {
        await send(chatId, "👆 Preview sent above — tap Quote-tweet to post it.");
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /rt [keyword] ────────────────────────────────────────────────────────
  else if (cmd === "/rt") {
    const keyword = args.trim() || NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];
    await send(chatId, `🔍 Finding a niche tweet to repost (topic: "${keyword}")...`);
    try {
      const tweets = await searchTweets(`${keyword} -is:retweet lang:en is:verified`, 20);
      const scored = tweets
        .map(t => ({
          ...t,
          score: (t.public_metrics?.like_count ?? 0)
            + (t.public_metrics?.retweet_count ?? 0) * 4
            + (t.public_metrics?.quote_count ?? 0) * 3,
        }))
        .filter(t => t.score >= 20)
        .sort((a, b) => b.score - a.score);

      if (!scored.length) {
        await send(chatId, "❌ No high-traction tweets found for that topic. Try a different keyword.");
        return NextResponse.json({ ok: true });
      }
      const tweet = scored[Math.floor(Math.random() * Math.min(scored.length, 3))];
      const tweetScore = (tweet as typeof tweet & { score?: number }).score ?? 0;
      const tweetStats = `❤️ ${tweet.public_metrics?.like_count ?? 0} · 🔁 ${tweet.public_metrics?.retweet_count ?? 0}`;
      const item = await prisma.queueItem.create({
        data: {
          type: "NicheRT",
          content: tweet.text,
          metadata: { tweetId: tweet.id, authorUsername: tweet.author_username, keyword, score: tweetScore },
        },
      });
      await send(chatId,
        `*🔁 Repost this?*\n\n` +
        `@${tweet.author_username}: _"${tweet.text.slice(0, 300)}"_\n\n` +
        `🎯 "${keyword}" · ${tweetStats}\n_ID: \`${item.id}\`_`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "🔁 Retweet",   callback_data: `niche_rt:${item.id}` },
              { text: "💬 Quote-tweet", callback_data: `niche_quote:${item.id}` },
              { text: "❌ Skip",       callback_data: `reject:${item.id}` },
            ]],
          },
        }
      );
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /blast <text> ─────────────────────────────────────────────────────────
  else if (cmd === "/blast") {
    if (!args) {
      await send(chatId,
        `📤 *Blast to X + LinkedIn*\n\nUsage: \`/blast Your post text here\`\n\n` +
        `_Posts the same text to both platforms immediately._`
      );
    } else {
      await send(chatId, "📤 Blasting to X + LinkedIn...");
      try {
        const [xResult] = await Promise.allSettled([postTweet(args)]);
        const xOk = xResult.status === "fulfilled";

        let liOk = false;
        let liError = "";
        try {
          await postToLinkedIn(args);
          liOk = true;
        } catch (e) {
          liError = String(e).slice(0, 100);
        }

        await prisma.activity.create({
          data: { action: "Blast posted", detail: args.slice(0, 80), icon: "📤" },
        });

        await send(chatId,
          `*📤 Blast result*\n\n` +
          `𝕏 Twitter: ${xOk ? "✅ Posted" : `❌ ${(xResult as PromiseRejectedResult).reason?.toString().slice(0, 60)}`}\n` +
          `💼 LinkedIn: ${liOk ? "✅ Posted" : `❌ ${liError}`}\n\n` +
          `_${args.slice(0, 200)}_`
        );
      } catch (e) {
        await send(chatId, `❌ Error: ${String(e).slice(0, 120)}`);
      }
    }
  }

  // ── /topic <keyword> ──────────────────────────────────────────────────────
  else if (cmd === "/topic") {
    if (!args) {
      await send(chatId,
        `🎯 *Target a specific topic*\n\n` +
        `Usage: \`/topic keyword\`\n\n` +
        `Examples:\n\`/topic solopreneur tools\`\n\`/topic building in public\`\n\`/topic AI founder\`\n\n` +
        `_Runs a full engagement pass targeting only that keyword._`
      );
    } else {
      await send(chatId, `🎯 Engaging on: *"${args}"*...`);
      try {
        const res = await cronFetch(`/api/jobs/engage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: args }),
        });
        const r = await res.json();
        if (!res.ok || r.error) {
          await send(chatId, `❌ Engagement failed: ${r.error ?? "Unknown error"}`);
        } else {
          const commentLines = (r.comments ?? []).map(
            (c: { original: string; reply: string }) =>
              `_"${c.original}"_\n↩ ${c.reply}`
          ).join("\n\n");
          await send(chatId,
            `✅ *Engagement done* — ❤️ ${r.liked} likes · 💬 ${r.replied} comments\n` +
            `🎯 Topic: "${r.keyword}"\n\n` +
            (commentLines || "_No replies this run._")
          );
        }
      } catch (e) {
        await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
      }
    }
  }

  // ── /queue ────────────────────────────────────────────────────────────────
  else if (cmd === "/queue") {
    const items = await prisma.queueItem.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (!items.length) {
      await send(chatId, "📭 *Queue is empty.* No pending content awaiting approval.");
    } else {
      const lines = items.map((item, i) => {
        const t = new Date(item.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
        });
        const preview = item.content.split("---")[0].trim().slice(0, 80);
        return `${i + 1}. *${item.type}* · ${t}\n   _${preview}…_`;
      });
      await send(chatId,
        `*📋 Pending Approvals (${items.length})*\n\n${lines.join("\n\n")}\n\n` +
        `_Each item has Approve / Edit / Reject buttons above._`
      );
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

  // ── /inbox — show unread mentions with reply/skip buttons ────────────────
  else if (cmd === "/inbox") {
    await send(chatId, "🔍 Fetching unread mentions...");
    try {
      const me = await getMyProfile();
      const mentions = await getMentions(me.id);

      const recentReplied = await prisma.activity.findMany({
        where: { action: "Replied to mention", createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { detail: true },
        take: 500,
      });
      const repliedIds = new Set(
        recentReplied.map(a => a.detail?.match(/^mid:(\w+)/)?.[1]).filter(Boolean) as string[]
      );

      const unread = mentions.filter(m => m.id && !repliedIds.has(m.id)).slice(0, 5);

      if (!unread.length) {
        await send(chatId, "📭 No new mentions.");
        return NextResponse.json({ ok: true });
      }

      await send(chatId, `📬 *${unread.length} unread mention${unread.length > 1 ? "s" : ""}* — tap to reply or skip each one:`);

      for (const mention of unread) {
        // Reuse existing queue item if already created for this mention
        const existing = await prisma.queueItem.findFirst({
          where: { type: "Mention", status: "PENDING", metadata: { path: ["tweetId"], equals: mention.id } },
        });
        const item = existing ?? await prisma.queueItem.create({
          data: {
            type: "Mention",
            content: mention.text,
            metadata: { tweetId: mention.id, authorUsername: mention.author_username, authorId: mention.author_id },
          },
        });

        await send(chatId,
          `💬 *@${mention.author_username || mention.author_id}:*\n\n_"${mention.text.slice(0, 280)}"_`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "🤖 Auto-reply", callback_data: `reply_mention:${item.id}` },
                { text: "✏️ Custom",     callback_data: `custom_mention:${item.id}` },
                { text: "❌ Skip",       callback_data: `skip_mention:${item.id}` },
              ]],
            },
          }
        );
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── Edit response / custom mention reply: non-command text ───────────────
  else if (!cmd.startsWith("/")) {
    // Priority 1: pending tweet edit
    const pendingEdit = await prisma.queueItem.findFirst({
      where: { status: "PENDING", metadata: { path: ["awaitingEdit"], equals: true } },
    });
    if (pendingEdit) {
      await send(chatId, "⚡ Posting your edited version...");
      try {
        await postQueueItem({ ...pendingEdit, content: raw });
        await prisma.activity.create({
          data: { action: "Edited content posted", detail: raw.slice(0, 250), icon: "✏️" },
        });
        await send(chatId, `✅ *Edited version posted!*\n\n${raw.slice(0, 280)}`);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
      return NextResponse.json({ ok: true });
    }

    // Priority 2: pending custom mention reply
    const pendingMentionReply = await prisma.queueItem.findFirst({
      where: { type: "Mention", status: "PENDING", metadata: { path: ["awaitingMentionReply"], equals: true } },
    });
    if (pendingMentionReply) {
      const meta = (pendingMentionReply.metadata as Record<string, unknown>) ?? {};
      await send(chatId, "⚡ Sending your reply...");
      try {
        await replyToTweet(String(meta.tweetId), raw);
        await prisma.queueItem.update({ where: { id: pendingMentionReply.id }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: "Replied to mention", detail: `mid:${meta.tweetId}|${raw.slice(0, 70)}`, icon: "💬" },
        });
        await send(chatId, `✅ *Reply sent!*\n\n↩ ${raw.slice(0, 280)}`);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
