import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { prisma } from "@/lib/db";
import { postTweet, postTweetWithImage, postThread, quoteTweet, replyToTweet, isDailyLimitError } from "@/lib/x/post";
import { generateTweet, generateThread, generateDM, generateQuoteTweet, generateLinkedInPost, generateReply, generateLongTweet } from "@/lib/claude/generate";
import { notifyPosted, requestApproval, sendMessage } from "@/lib/telegram/notify";
import { ensureWebhook, ensureCommands } from "@/lib/telegram/setup";
import { humanPause } from "@/lib/scheduler/humanize";
import { getBrainFields, setBrainField, appendToThread } from "@/lib/brain";
import { getInsights } from "@/lib/brain/performance";
import { sendDM, getDMConversations } from "@/lib/x/dm";
import { searchTweets, getMyProfile, retweet, getMyTweets, getMentions } from "@/lib/x/engage";
import { getLinkedInAuth } from "@/lib/linkedin/client";
import { postToLinkedIn } from "@/lib/linkedin/post";
import { CONTENT_TOPICS, THREAD_TOPICS } from "@/lib/config";

const DEFAULT_BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const DEFAULT_CHAT = process.env.TELEGRAM_CHAT_ID!;
const APP = process.env.NEXTAUTH_URL!;

// Internal job fetches must carry CRON_SECRET so middleware allows them through
function cronFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
    "Authorization": `Bearer ${process.env.CRON_SECRET}`,
  };
  return fetch(`${APP}${path}`, { ...options, headers });
}

async function _send(botUrl: string, chatId: string, text: string, extra?: object) {
  await fetch(`${botUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
  });
}

async function _answerCallback(botUrl: string, id: string) {
  await fetch(`${botUrl}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id }),
  });
}

import { NICHE_KEYWORDS } from "@/lib/config";

// ── Shared: post an approved queue item ──────────────────────────────────────
async function postQueueItem(item: { id: string; type: string; content: string; metadata: unknown }) {
  const meta = (item.metadata as Record<string, unknown>) ?? {};
  const imageStyle = (meta.imageStyle as string | undefined) ?? "auto";
  if (item.type === "Thread") {
    const tweets = item.content.split("---").map((t: string) => t.trim()).filter(Boolean);
    const imageMode = (["none", "first", "all"].includes(meta.imageMode as string)
      ? meta.imageMode
      : "none") as "none" | "first" | "all";
    await postThread(tweets, imageMode, imageStyle);
  } else {
    if (meta.withImage) {
      await postTweetWithImage(item.content, imageStyle);
    } else {
      await postTweet(item.content);
    }
  }
  await prisma.queueItem.update({ where: { id: item.id }, data: { status: "POSTED" } });
  await prisma.activity.create({
    data: { action: `${item.type} approved & posted`, detail: item.content.slice(0, 280), icon: "✅" },
  });
}

export async function POST(req: NextRequest) {
  try {
  // ── Per-user bot resolution ───────────────────────────────────────────────
  // SaaS users register their own bot webhook with ?userId=X appended to the URL.
  // Varun's default bot uses env vars (userId=null).
  const reqUserId = new URL(req.url).searchParams.get("userId") ?? null;
  let activeBotUrl = DEFAULT_BOT;
  let activeChatId = DEFAULT_CHAT;

  if (reqUserId) {
    const tgSetup = await prisma.telegramSetup.findUnique({ where: { userId: reqUserId } }).catch(() => null);
    if (tgSetup) {
      activeBotUrl = `https://api.telegram.org/bot${tgSetup.botToken}`;
      activeChatId = tgSetup.chatId;
    }
  }

  // Request-scoped helpers — shadow nothing, just capture bot/chat for this request
  const send = (chatId: string, text: string, extra?: object) => _send(activeBotUrl, chatId, text, extra);
  const answerCallback = (id: string) => _answerCallback(activeBotUrl, id);

  // Verify Telegram webhook secret — only reject if BOTH a secret is configured
  // AND Telegram sent a non-empty header that doesn't match (prevents lockout when
  // webhook was registered without a secret but env var still has an old value).
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (incoming && incoming !== webhookSecret) {
      return NextResponse.json({ ok: true });
    }
  }

  const body = await req.json();

  // ── Inline button callbacks ──────────────────────────────────────────────
  if (body.callback_query) {
    const { data, from, id: cbId } = body.callback_query;
    const chatId = String(from.id);
    if (activeChatId && chatId !== activeChatId) return NextResponse.json({ ok: true });

    await answerCallback(cbId);

    const colonIdx = data.indexOf(":");
    const action = data.slice(0, colonIdx);
    const param = data.slice(colonIdx + 1);

    // ── Approval flow callbacks ──────────────────────────────────────────────
    if (action === "approve") {
      // Atomic claim — only one concurrent tap can win the PENDING→APPROVED transition
      const claimed = await prisma.queueItem.updateMany({
        where: { id: param, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      if (claimed.count === 0) {
        await send(chatId, "⚠️ Item not found or already processed.");
        return NextResponse.json({ ok: true });
      }
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item) return NextResponse.json({ ok: true });
      await send(chatId, "⚡ Posting now...");
      try {
        await humanPause();
        await postQueueItem(item);
        await send(chatId, `✅ *Posted!*\n\n${item.content.slice(0, 280)}`);
      } catch (e) {
        if (isDailyLimitError(e)) {
          await prisma.queueItem.update({ where: { id: param }, data: { status: "PENDING" } });
          await send(chatId,
            `⛔ *Daily tweet limit hit (X error 344)*\n\n` +
            `Item kept in queue — tap Approve again after midnight UTC.\n\n` +
            `_Use /pause to stop automation for today, then /resume tomorrow._`
          );
        } else {
          await send(chatId, `❌ Post failed: ${String(e).slice(0, 120)}`);
        }
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
        const { sendDM: xSendDM } = await import("@/lib/x/dm");
        let targetId = String(meta.targetId ?? "");
        if (!targetId) {
          const { getUserByUsername } = await import("@/lib/x/engage");
          const user = await getUserByUsername(String(meta.targetUsername));
          if (!user?.id) throw new Error(`@${meta.targetUsername} not found`);
          targetId = user.id;
        }
        await xSendDM(targetId, item.content);
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
        await humanPause();
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
        if (isDailyLimitError(e)) {
          await prisma.queueItem.update({ where: { id: param }, data: { status: "PENDING" } });
          await send(chatId,
            `⛔ *Daily tweet limit hit (X error 344)*\n\n` +
            `Item kept in queue — tap Approve again after midnight UTC.\n\n` +
            `_Use /pause to stop automation for today, then /resume tomorrow._`
          );
        } else {
          await send(chatId, `❌ Cross-post error: ${String(e).slice(0, 150)}`);
        }
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
      await send(chatId, "✍️ Generating tweet...");
      try {
        const pillar = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
        const content = await generateTweet(pillar);
        const item = await prisma.queueItem.create({
          data: { type: "Tweet", content, metadata: { withImage: true, imageStyle: "auto" } },
        });
        await send(chatId,
          `*Pick an image style:*\n\n${content}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🌑 Dark",     callback_data: `img_style:dark:${item.id}` },
                  { text: "☀️ Light",    callback_data: `img_style:light:${item.id}` },
                  { text: "🏷️ Branded",  callback_data: `img_style:branded:${item.id}` },
                ],
                [
                  { text: "📰 Article",  callback_data: `img_style:article:${item.id}` },
                  { text: "📊 Data",     callback_data: `img_style:data:${item.id}` },
                  { text: "🎲 Auto",     callback_data: `img_style:auto:${item.id}` },
                ],
                [
                  { text: "❌ No image", callback_data: `img_style:none:${item.id}` },
                ],
              ],
            },
          }
        );
      } catch (e) { await send(chatId, `❌ ${String(e).slice(0, 100)}`); }
    }

    // ── Image style picker result ─────────────────────────────────────────────
    if (action === "img_style") {
      const [style, itemId] = [param.split(":")[0], param.split(":").slice(1).join(":")];
      const item = await prisma.queueItem.findUnique({ where: { id: itemId } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item expired or already handled.");
        return NextResponse.json({ ok: true });
      }
      if (style === "none") {
        await prisma.queueItem.update({ where: { id: itemId }, data: { metadata: { ...(item.metadata as object), withImage: false, imageStyle: "none" } } });
      } else {
        await prisma.queueItem.update({ where: { id: itemId }, data: { metadata: { ...(item.metadata as object), withImage: true, imageStyle: style } } });
      }
      const styleLabel: Record<string, string> = { dark: "🌑 Dark", light: "☀️ Light", branded: "🏷️ Branded", article: "📰 Article", data: "📊 Data", auto: "🎲 Auto", none: "❌ No image" };
      await send(chatId,
        `*Style: ${styleLabel[style] ?? style}*\n\n${item.content}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Post →",  callback_data: `approve:${itemId}` },
              { text: "✏️ Edit",   callback_data: `edit:${itemId}` },
              { text: "❌ Skip",   callback_data: `reject:${itemId}` },
            ]],
          },
        }
      );
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

    if (action === "thread_img_first" || action === "thread_img_all") {
      const existingId = param; // non-empty when called from article/existing item
      if (existingId) {
        // Existing item — just show style picker
        const existing = await prisma.queueItem.findUnique({ where: { id: existingId } });
        if (existing && existing.status === "PENDING") {
          const mode = action === "thread_img_all" ? "all" : "first";
          await prisma.queueItem.update({ where: { id: existingId }, data: { metadata: { ...(existing.metadata as object), imageMode: mode, imageStyle: "auto" } } });
          await send(chatId,
            `*Thread image style — pick one:*\n\n_${existing.content.slice(0, 200)}_`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "🌑 Dark",     callback_data: `img_style:dark:${existingId}` },
                    { text: "☀️ Light",    callback_data: `img_style:light:${existingId}` },
                    { text: "🏷️ Branded",  callback_data: `img_style:branded:${existingId}` },
                  ],
                  [
                    { text: "📰 Article",  callback_data: `img_style:article:${existingId}` },
                    { text: "📊 Data",     callback_data: `img_style:data:${existingId}` },
                    { text: "🎲 Auto",     callback_data: `img_style:auto:${existingId}` },
                  ],
                ],
              },
            }
          );
        }
        return NextResponse.json({ ok: true });
      }
      // No existing item — generate new thread, then show style picker
      await send(chatId, "✍️ Generating thread...");
      try {
        const pillar = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
        const tweets = await generateThread(pillar);
        const content = tweets.join("\n---\n");
        const mode = action === "thread_img_all" ? "all" : "first";
        const item = await prisma.queueItem.create({
          data: { type: "Thread", content, metadata: { imageMode: mode, imageStyle: "auto" } },
        });
        await send(chatId,
          `*Thread ready — pick image style:*\n\n*${pillar}*\n\n${tweets[0]}\n\n_[+ ${tweets.length - 1} more]_`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🌑 Dark",     callback_data: `img_style:dark:${item.id}` },
                  { text: "☀️ Light",    callback_data: `img_style:light:${item.id}` },
                  { text: "🏷️ Branded",  callback_data: `img_style:branded:${item.id}` },
                ],
                [
                  { text: "📰 Article",  callback_data: `img_style:article:${item.id}` },
                  { text: "📊 Data",     callback_data: `img_style:data:${item.id}` },
                  { text: "🎲 Auto",     callback_data: `img_style:auto:${item.id}` },
                ],
                [
                  { text: "❌ No image", callback_data: `img_style:none:${item.id}` },
                ],
              ],
            },
          }
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

    // ── Mention approval: send the pre-generated reply ───────────────────────
    if (action === "approve_mention") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Mention already handled.");
        return NextResponse.json({ ok: true });
      }
      const meta = (item.metadata as Record<string, unknown>) ?? {};
      await send(chatId, "⚡ Sending reply...");
      try {
        await humanPause();
        await replyToTweet(String(meta.tweetId), item.content);
        await prisma.queueItem.update({ where: { id: param }, data: { status: "POSTED" } });
        const { buildReplyDetail } = await import("@/lib/reply-dedup");
        await prisma.activity.create({
          data: { action: "Replied to mention", detail: buildReplyDetail(String(meta.tweetId), String(meta.authorId ?? ""), item.content), icon: "💬" },
        });
        // Record both sides of the conversation for thread memory — guard empty authorId
        const _aId = meta.authorId && String(meta.authorId).trim() ? String(meta.authorId) : null;
        if (_aId && meta.originalText) {
          await appendToThread(_aId, String(meta.authorUsername ?? ""), {
            role: "them", content: String(meta.originalText), tweetId: String(meta.tweetId), at: new Date().toISOString(),
          });
          await appendToThread(_aId, String(meta.authorUsername ?? ""), {
            role: "us", content: item.content, tweetId: String(meta.tweetId), at: new Date().toISOString(),
          });
        }
        await send(chatId,
          `✅ *Reply sent to @${meta.authorUsername || "them"}!*\n\n↩ ${item.content.slice(0, 240)}`
        );
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
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
        // item.content is the pre-generated reply for cron items, or the mention text for /inbox items.
        // originalText (when present) is always the mention text — use it for generateReply and thread recording.
        const mentionText = String(meta.originalText || item.content);
        const authorId = meta.authorId && String(meta.authorId).trim() ? String(meta.authorId) : undefined;
        const reply = await generateReply(mentionText, String(meta.authorUsername || "user"), authorId);
        await humanPause();
        await replyToTweet(String(meta.tweetId), reply);
        await prisma.queueItem.update({ where: { id: param }, data: { status: "POSTED" } });
        const { buildReplyDetail } = await import("@/lib/reply-dedup");
        await prisma.activity.create({
          data: { action: "Replied to mention", detail: buildReplyDetail(String(meta.tweetId), authorId ?? "", reply), icon: "💬" },
        });
        // Record both sides to thread memory — guard empty authorId
        if (authorId) {
          await appendToThread(authorId, String(meta.authorUsername ?? ""), {
            role: "them", content: mentionText, tweetId: String(meta.tweetId), at: new Date().toISOString(),
          });
          await appendToThread(authorId, String(meta.authorUsername ?? ""), {
            role: "us", content: reply, tweetId: String(meta.tweetId), at: new Date().toISOString(),
          });
        }
        await send(chatId,
          `✅ *Reply sent!*\n\n_They said:_ "${mentionText.slice(0, 150)}"\n\n↩ ${reply}`
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

    // ── Lead pipeline callbacks ──────────────────────────────────────────────
    if (action === "leads_stage") {
      const leads = await prisma.leadProfile.findMany({
        where: { userId: reqUserId, stage: param as never },
        orderBy: { warmthScore: "desc" },
        take: 8,
        select: { username: true, warmthScore: true, aiSummary: true },
      });
      if (!leads.length) {
        await send(chatId, `No leads in *${param}* stage.`);
      } else {
        const lines = leads.map(l =>
          `@${l.username} · score ${l.warmthScore}${l.aiSummary ? `\n_${l.aiSummary.slice(0, 70)}_` : ""}`
        ).join("\n\n");
        await send(chatId, `*${param} (${leads.length}):*\n\n${lines}`);
      }
    }

    if (action === "lead_dm") {
      const lead = await prisma.leadProfile.findUnique({ where: { id: param } });
      if (!lead) { await send(chatId, "Lead not found."); return NextResponse.json({ ok: true }); }
      await send(chatId, `📩 Generating DM for @${lead.username}...`);
      try {
        const { appendDmHistory, logLeadActivity } = await import("@/lib/leads/profile");
        const { generateDM: genDM } = await import("@/lib/claude/generate");
        const { sendDM: xSendDM } = await import("@/lib/x/dm");
        const { getUserCtx: getCtx } = await import("@/lib/user-context");
        const ctx = await getCtx(reqUserId);
        const context = lead.aiSummary ?? lead.bio ?? `@${lead.username}`;
        const dmText = await genDM(lead.username, context);
        await xSendDM(lead.twitterUserId, dmText, { wClient: ctx.scraperW });
        await appendDmHistory(lead.id, { sent: dmText, at: new Date().toISOString() });
        await logLeadActivity(lead.id, "dm_sent", dmText.slice(0, 100));
        await prisma.leadProfile.update({ where: { id: lead.id }, data: { stage: "DM_SENT" } });
        await send(chatId, `✅ *DM sent to @${lead.username}!*\n\n_"${dmText.slice(0, 200)}"_`);
      } catch (e) {
        await send(chatId, `❌ DM failed: ${String(e).slice(0, 120)}`);
      }
    }

    if (action === "lead_convert") {
      await prisma.leadProfile.update({ where: { id: param }, data: { stage: "CONVERTED" } });
      const lead = await prisma.leadProfile.findUnique({ where: { id: param }, select: { username: true } });
      await send(chatId, `✅ @${lead?.username ?? param} marked as *CONVERTED*!`);
    }

    if (action === "lead_remove") {
      await prisma.leadProfile.update({ where: { id: param }, data: { stage: "REMOVED" } });
      const lead = await prisma.leadProfile.findUnique({ where: { id: param }, select: { username: true } });
      await send(chatId, `🗑️ @${lead?.username ?? param} removed from pipeline.`);
    }

    if (action === "dm_send") {
      await send(chatId,
        `📨 *Send a DM*\n\nReply with this format:\n\n` +
        "`/dm @username [optional context about them]`\n\n" +
        `Examples:\n` +
        "`/dm @johndoe`\n" +
        "`/dm @janefoo she builds SaaS tools and tweets about growth`\n\n" +
        `_Phantom generates a feedback-ask DM and sends it via X._`
      );
    }

    // ── Regenerate: generate fresh content for an existing pending item ──────────
    // ── Brain field quick-edit (from /status buttons) ────────────────────────
    if (action === "brain_edit") {
      const field = param; // "focus" | "avoid" | "notes"
      const labels: Record<string, string> = { focus: "current focus", avoid: "what to avoid", notes: "notes / scratchpad" };
      const brain = await getBrainFields().catch(() => null);
      const current = brain?.[field] ?? "";
      // Clear any stale pending brain edits first (user tapped but never replied)
      await prisma.queueItem.updateMany({
        where: { type: "BrainEdit", status: "PENDING" },
        data: { status: "REJECTED" },
      });
      await prisma.queueItem.create({
        data: { type: "BrainEdit", content: field, metadata: { awaitingBrainEdit: true, field } },
      });
      await send(chatId,
        `✏️ *Edit ${labels[field] ?? field}*\n\nCurrent:\n_${current.slice(0, 300) || "empty"}_\n\nReply with the new value:`,
        { reply_markup: { force_reply: true, selective: true } }
      );
    }

    if (action === "regenerate") {
      const item = await prisma.queueItem.findUnique({ where: { id: param } });
      if (!item || item.status !== "PENDING") {
        await send(chatId, "⚠️ Item not found or already handled.");
        return NextResponse.json({ ok: true });
      }
      await send(chatId, "🔄 Generating a fresh version...");
      try {
        const [postedItems, pendingItems] = await Promise.all([
          prisma.queueItem.findMany({ where: { status: "POSTED" }, orderBy: { updatedAt: "desc" }, take: 50, select: { content: true } }),
          prisma.queueItem.findMany({ where: { status: "PENDING", id: { not: item.id } }, select: { content: true }, take: 10 }),
        ]);
        const recentTweets = [...postedItems.map(q => q.content), ...pendingItems.map(q => q.content)];

        let newContent: string;
        const meta = (item.metadata as Record<string, unknown>) ?? {};

        if (item.type === "Thread") {
          const { THREAD_TOPICS } = await import("@/lib/config");
          const topic = THREAD_TOPICS[Math.floor(Math.random() * THREAD_TOPICS.length)];
          const tweets = await generateThread(topic);
          newContent = tweets.join("\n---\n");
        } else if (meta.longpost) {
          const { CONTENT_TOPICS } = await import("@/lib/config");
          const topic = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
          newContent = await generateLongTweet(topic, recentTweets);
        } else {
          const { CONTENT_TOPICS } = await import("@/lib/config");
          const topic = CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
          newContent = await generateTweet(topic, undefined, recentTweets);
        }

        await prisma.queueItem.update({ where: { id: item.id }, data: { content: newContent } });

        const label = meta.longpost ? "Long-form post (regenerated)" : item.type === "Thread" ? "Thread (regenerated)" : "Tweet (regenerated)";
        const { requestApproval } = await import("@/lib/telegram/notify");
        await requestApproval(label, newContent, { id: item.id });
      } catch (e) {
        await send(chatId, `❌ Regeneration failed: ${String(e).slice(0, 120)}`);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ── Text commands ────────────────────────────────────────────────────────
  const msg = body.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId = String(msg.chat.id);
  if (activeChatId && chatId !== activeChatId) return NextResponse.json({ ok: true });

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
      `/longpost [topic] — Premium+ long-form post (up to 2000 chars)\n` +
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
      `/dm @username [context] — send a feedback-ask DM\n\n` +
      `*Lead Generation*\n` +
      `/leads — pipeline overview (discovered/warming/DM'd/responded/converted)\n` +
      `/leads warming — drill into a stage\n` +
      `/lead @username — full prospect profile + action buttons\n` +
      `/icp — view ICP targeting config\n\n` +
      `*Dashboard*\n` +
      `/status — live stats (both platforms)\n` +
      `/today — what Phantom did since midnight\n` +
      `/activity — last 10 actions\n` +
      `/queue — pending approvals with live buttons\n` +
      `/schedule — automation schedule\n` +
      `/waitlist — all waitlist signups with dates\n\n` +
      `*Control*\n` +
      `/pause — pause all automation (queue kept)\n` +
      `/kill — hard stop: pause + wipe entire pending queue\n` +
      `/resume — resume automation\n` +
      `/blacklist <username> — silently ignore an account\n` +
      `/setup — register webhook & command menu\n` +
      `/test — test X API connectivity\n\n` +
      `_All scheduled posts send a preview here first. Tap Approve or 🔄 New version._`,
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
      const [statsRes, recentActivity, totalPosted, totalReplied, brain, latestInsights] = await Promise.all([
        cronFetch(`/api/stats`).then(r => r.json()).catch(() => ({})),
        prisma.activity.findMany({ orderBy: { createdAt: "desc" }, take: 3 }),
        prisma.activity.count({ where: { icon: { in: ["🐦", "🧵", "🖼️"] } } }),
        prisma.activity.count({ where: { icon: "💬" } }),
        getBrainFields().catch(() => null),
        getInsights(1).catch(() => []),
      ]);

      const lastAct = recentActivity[0];
      const lastTime = lastAct
        ? new Date(lastAct.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
        : "—";

      const brainSection = brain
        ? `\n*Brain*\n` +
          `🎯 Focus: _${brain.focus?.slice(0, 100) ?? "—"}_\n` +
          (latestInsights[0] ? `💡 Latest insight: _${latestInsights[0].insight.slice(0, 100)}_\n` : "") +
          (brain.wins ? `✅ What's working: _${brain.wins.slice(0, 80)}_\n` : "")
        : "";

      await send(chatId,
        `*📊 Phantom Dashboard*\n\n` +
        `*X Account (${process.env.X_HANDLE ?? "@yourusername"})*\n` +
        `👥 Followers: ${statsRes.followers ?? "—"}\n` +
        `👤 Following: ${statsRes.following ?? "—"}\n` +
        `🐦 Tweets: ${statsRes.tweets ?? "—"}\n\n` +
        `*Automation Stats*\n` +
        `📮 Posts sent: ${totalPosted}\n` +
        `💬 Replies sent: ${totalReplied}\n` +
        `⚡ Engagements: ${statsRes.engagements ?? "—"}\n` +
        brainSection +
        `\n*Last action:* ${lastAct ? `${lastAct.icon} ${lastAct.action}` : "None"} at ${lastTime}\n\n` +
        `_All systems running on autopilot._`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "🎯 Edit focus",  callback_data: "brain_edit:focus" },
              { text: "🚫 Edit avoid",  callback_data: "brain_edit:avoid" },
              { text: "📝 Notes",       callback_data: "brain_edit:notes" },
            ]],
          },
        }
      );
    } catch (e) {
      await send(chatId, `❌ Error fetching status: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /activity ─────────────────────────────────────────────────────────────
  else if (cmd === "/activity") {
    const actFilter = reqUserId ? { userId: reqUserId } : { userId: null };
    const items = await prisma.activity.findMany({
      where: actFilter,
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

  // ── /today ────────────────────────────────────────────────────────────────
  else if (cmd === "/today") {
    try {
      const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      nowIST.setHours(0, 0, 0, 0);
      // Convert back to UTC for the DB query
      const midnightUTC = new Date(nowIST.getTime() - (5.5 * 60 * 60 * 1000));

      const todayActivity = await prisma.activity.findMany({
        where: { createdAt: { gte: midnightUTC } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      if (!todayActivity.length) {
        await send(chatId, "📭 *Nothing logged today yet.*\n\n_Check cron-job.org if automation should have fired._");
      } else {
        const counts: Record<string, number> = {};
        for (const a of todayActivity) {
          const key = a.action.split("—")[0].trim().split(":")[0].trim();
          counts[key] = (counts[key] ?? 0) + 1;
        }
        const bullets = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  ${v}× ${k}`)
          .join("\n");

        const highlights = todayActivity
          .filter(a => ["🐦", "🧵", "📝"].includes(a.icon ?? ""))
          .slice(0, 3)
          .map(a => `  ${a.icon} _${a.detail?.slice(0, 80) ?? a.action}_`)
          .join("\n");

        const lastTime = new Date(todayActivity[0].createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
        });

        await send(chatId,
          `*📅 Today's Activity*\n\n` +
          `${bullets}\n\n` +
          (highlights ? `*Content posted:*\n${highlights}\n\n` : "") +
          `_Last action: ${lastTime} IST · ${todayActivity.length} total_`
        );
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
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

  // ── /longpost [topic] ────────────────────────────────────────────────────
  else if (cmd === "/longpost") {
    await send(chatId, "📝 Generating long-form post (Premium+)...");
    try {
      const [postedItems, pendingItems] = await Promise.all([
        prisma.queueItem.findMany({ where: { status: "POSTED" }, orderBy: { updatedAt: "desc" }, take: 50, select: { content: true } }),
        prisma.queueItem.findMany({ where: { status: "PENDING" }, select: { content: true }, take: 10 }),
      ]);
      const recentTweets = [...postedItems.map(q => q.content), ...pendingItems.map(q => q.content)];
      const { CONTENT_TOPICS } = await import("@/lib/config");
      const topic = args || CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
      const content = await generateLongTweet(topic, recentTweets);
      const item = await prisma.queueItem.create({
        data: { type: "Tweet", content, metadata: { withImage: false, longpost: true } },
      });
      await send(chatId,
        `*📝 Long-form post (${content.length} chars)*\n\n${content.slice(0, 1200)}${content.length > 1200 ? `\n_[+${content.length - 1200} more]_` : ""}`,
        { reply_markup: { inline_keyboard: [
          [
            { text: "✅ Post it",      callback_data: `approve:${item.id}` },
            { text: "✏️ Edit",         callback_data: `edit:${item.id}` },
            { text: "❌ Skip",         callback_data: `reject:${item.id}` },
          ],
          [
            { text: "🔄 New version",  callback_data: `regenerate:${item.id}` },
            { text: "📤 X + LinkedIn", callback_data: `approve_xl:${item.id}` },
          ],
        ] } }
      );
    } catch (e) {
      await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
    }
  }

  // ── /post <custom text> ───────────────────────────────────────────────────
  else if (cmd === "/post") {
    if (!args) {
      await send(chatId, "Usage: `/post Your tweet text here`");
    } else {
      await send(chatId, "⚡ Posting now...");
      try {
        await humanPause();
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
    const count = Math.min(parseInt(args || "3", 10) || 3, 5);
    // Fire-and-forget — follow takes 40-60s due to human-paced delays.
    // Respond immediately; the job sends its own Telegram notification when done.
    cronFetch(`/api/jobs/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    }).catch(() => null);
    await send(chatId,
      `🤝 *Follow run started* — following up to ${count} accounts.\n\n` +
      `_Takes ~1 min (human-paced delays). You'll get a report when it's done._`
    );
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
      `🐦 *Tweets* — 7:28am · 12:28pm · 6:28pm · 9:28pm\n` +
      `   _4×/day · randomly: plain tweet, image tweet, thread, or resurface_\n\n` +
      `📝 *Long-form (Premium+)* — daily 10:28am\n` +
      `   _600–1800 char mini-essay · approval-gated_\n\n` +
      `📰 *Articles* — Wed & Sat 9:28am\n` +
      `   _6-tweet educational thread + cover image auto-attached_\n\n` +
      `🧵 *Bonus threads* — Mon & Thu 2:28pm\n` +
      `   _On top of the regular post slot_\n\n` +
      `💬 *Mentions* — every 15 min, 24/7\n` +
      `   _Auto-replies · permanent dedup (never replies twice to same mention)_\n\n` +
      `⚡ *Engagement* — every 15 min, 24/7\n` +
      `   _Likes + replies · 7-day dedup across all reply crons_\n\n` +
      `🗣️ *Go-out comments* — 8×/day weekdays · 9×/day weekends\n` +
      `   _Targeted comments on niche threads · randomised timing_\n\n` +
      `🤝 *Follow* — 8×/day weekdays · 9×/day weekends\n` +
      `   _Up to 3 follows per run · randomised timing_\n\n` +
      `📨 *Auto DM* — 8×/day weekdays · 9×/day weekends\n` +
      `   _Feedback-ask DMs to active builders · approval-gated_\n\n` +
      `🔁 *Niche RT* — daily 4:28pm\n\n` +
      `💼 *LinkedIn* — Tue–Fri 8:28am\n` +
      `   _Randomly: thought leadership, story, or list_\n\n` +
      `📊 *Daily summary* — 11:28pm\n\n` +
      `_All timings shift ±14 min daily to avoid X pattern detection._`
    );
  }

  // ── /pause ────────────────────────────────────────────────────────────────
  else if (cmd === "/pause") {
    if (reqUserId) {
      await prisma.stats.upsert({ where: { userId: reqUserId }, update: { paused: true }, create: { id: reqUserId, userId: reqUserId, paused: true } });
    } else {
      await prisma.stats.upsert({ where: { id: "singleton" }, update: { paused: true }, create: { paused: true } });
    }
    await prisma.activity.create({ data: { userId: reqUserId, action: "Automation paused", icon: "⏸️" } });
    await send(chatId,
      "⏸️ *Paused.*\n\nAll cron jobs will skip until you /resume.\nQueue and existing content untouched.\n\n_Use /kill to also wipe the pending queue._"
    );
  }

  // ── /kill — hard stop: pause + clear entire queue ─────────────────────────
  else if (cmd === "/kill") {
    await send(chatId, "🛑 Shutting everything down...");
    try {
      // 1. Pause all automation
      if (reqUserId) {
        await prisma.stats.upsert({ where: { userId: reqUserId }, update: { paused: true }, create: { id: reqUserId, userId: reqUserId, paused: true } });
      } else {
        await prisma.stats.upsert({ where: { id: "singleton" }, update: { paused: true }, create: { paused: true } });
      }

      // 2. Reject all pending queue items so nothing fires on resume
      const wipeFilter = reqUserId ? { status: "PENDING" as const, userId: reqUserId } : { status: "PENDING" as const, userId: null };
      const wiped = await prisma.queueItem.updateMany({
        where: wipeFilter,
        data: { status: "REJECTED" },
      });

      // 3. Log it
      await prisma.activity.create({
        data: { userId: reqUserId, action: "Hard stop — all automation killed", detail: `${wiped.count} pending items cleared`, icon: "🛑" },
      });

      await send(chatId,
        `🛑 *Everything stopped.*\n\n` +
        `✓ Automation paused\n` +
        `✓ ${wiped.count} pending queue items cleared\n` +
        `✓ No posts, replies, likes, or DMs will fire\n\n` +
        `Send /resume when you're ready to restart.\n` +
        `_New content will need to be generated fresh._`
      );
    } catch (e) {
      await send(chatId, `❌ Kill failed: ${String(e).slice(0, 120)}`);
    }
  }

  // ── /resume ───────────────────────────────────────────────────────────────
  else if (cmd === "/resume") {
    if (reqUserId) {
      await prisma.stats.upsert({ where: { userId: reqUserId }, update: { paused: false }, create: { id: reqUserId, userId: reqUserId, paused: false } });
    } else {
      await prisma.stats.upsert({ where: { id: "singleton" }, update: { paused: false }, create: { paused: false } });
    }
    await prisma.activity.create({ data: { userId: reqUserId, action: "Automation resumed", icon: "▶️" } });
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

    // DM send test — isLoggedIn() is unreliable (verify_credentials.json removed by X for free tier).
    // Instead confirm cookies are loaded; Auth ✅ above already proves the session is live.
    try {
      await (await import("@/lib/x/client")).getXClient();
      const hasCookies = !!(process.env.X_COOKIES);
      lines.push(hasCookies ? `✅ *DM (cookie session active)*` : `⚠️ *DM — X_COOKIES not set*`);
    } catch (e) {
      lines.push(`❌ *DM* — ${String(e).slice(0, 80)}`);
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
      await send(chatId, `✍️ Generating DM for @${username}...`);
      try {
        const { getUserByUsername } = await import("@/lib/x/engage");
        const user = await getUserByUsername(username);
        if (!user?.id) throw new Error(`@${username} not found`);
        const dmText = await generateDM(username, context || `a creator in the ${NICHE_KEYWORDS[0]} space`);
        const item = await prisma.queueItem.create({
          data: {
            type: "DM",
            content: dmText,
            metadata: { targetUsername: username, targetId: user.id },
          },
        });
        await send(chatId,
          `*📨 Send this DM?*\n\nTo: @${username}\n\n\`\`\`\n${dmText}\n\`\`\``,
          { reply_markup: { inline_keyboard: [[
            { text: "✅ Send DM",  callback_data: `approve_dm:${item.id}` },
            { text: "✏️ Edit",    callback_data: `edit:${item.id}` },
            { text: "❌ Skip",    callback_data: `reject:${item.id}` },
          ]] } }
        );
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
        .filter(t => t.score >= 3 && t.text.trim().length > 20)
        .sort((a, b) => b.score - a.score);

      if (!scored.length) {
        await send(chatId, "❌ No tweets found for that topic. Try a broader keyword.");
        return NextResponse.json({ ok: true });
      }
      const tweet = scored[Math.floor(Math.random() * Math.min(scored.length, 5))];
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
    const queueFilter = reqUserId ? { status: "PENDING" as const, userId: reqUserId } : { status: "PENDING" as const, userId: null };
    const items = await prisma.queueItem.findMany({
      where: queueFilter,
      orderBy: { createdAt: "asc" },
      take: 8,
    });
    if (!items.length) {
      await send(chatId, "📭 *Queue is empty.* No pending content awaiting approval.");
    } else {
      await send(chatId, `*📋 Pending Approvals (${items.length})*`);
      for (const item of items) {
        const t = new Date(item.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
        });
        const meta = (item.metadata as Record<string, unknown>) ?? {};
        const preview = item.content.split("---")[0].trim().slice(0, 300);
        const typeLabel = item.type === "Thread"
          ? "🧵 Thread"
          : meta.longpost ? "📝 Long post"
          : item.type === "DM" ? `📨 DM → @${meta.targetUsername ?? "?"}`
          : item.type === "NicheRT" ? `🔁 RT @${meta.authorUsername ?? "?"}`
          : item.type === "Mention" ? `💬 Mention @${meta.authorUsername ?? "?"}`
          : "🐦 Tweet";

        if (item.type === "DM") {
          await send(chatId,
            `*${typeLabel}* · ${t}\n\n\`\`\`\n${preview}\n\`\`\``,
            { reply_markup: { inline_keyboard: [[
              { text: "✅ Send DM",    callback_data: `approve_dm:${item.id}` },
              { text: "✏️ Edit",       callback_data: `edit:${item.id}` },
              { text: "❌ Skip",       callback_data: `reject:${item.id}` },
            ]] } }
          );
        } else if (item.type === "NicheRT") {
          await send(chatId,
            `*${typeLabel}* · ${t}\n\n_"${preview}"_`,
            { reply_markup: { inline_keyboard: [[
              { text: "🔁 Retweet",      callback_data: `niche_rt:${item.id}` },
              { text: "💬 Quote-tweet",  callback_data: `niche_quote:${item.id}` },
              { text: "❌ Skip",         callback_data: `reject:${item.id}` },
            ]] } }
          );
        } else if (item.type === "Mention") {
          await send(chatId,
            `*${typeLabel}* · ${t}\n\n_"${preview}"_`,
            { reply_markup: { inline_keyboard: [[
              { text: "🤖 Auto-reply",  callback_data: `reply_mention:${item.id}` },
              { text: "✏️ Custom",      callback_data: `custom_mention:${item.id}` },
              { text: "❌ Skip",        callback_data: `skip_mention:${item.id}` },
            ]] } }
          );
        } else {
          await send(chatId,
            `*${typeLabel}* · ${t}\n\n${preview}${item.content.length > 300 ? `\n_[+${item.content.length - 300} more chars]_` : ""}`,
            { reply_markup: { inline_keyboard: [
              [
                { text: "✅ Approve",     callback_data: `approve:${item.id}` },
                { text: "✏️ Edit",        callback_data: `edit:${item.id}` },
                { text: "❌ Reject",      callback_data: `reject:${item.id}` },
              ],
              [
                { text: "🔄 New version", callback_data: `regenerate:${item.id}` },
                { text: "📤 X + LinkedIn", callback_data: `approve_xl:${item.id}` },
              ],
            ] } }
          );
        }
      }
    }
  }

  // ── /clearstale — reject queue items older than 6h (clears backed-up queue) ─
  else if (cmd === "/clearstale") {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const wiped = await prisma.queueItem.updateMany({
      where: { status: "PENDING", createdAt: { lt: cutoff } },
      data: { status: "REJECTED" },
    });
    await send(chatId,
      `🧹 *Cleared ${wiped.count} stale item${wiped.count !== 1 ? "s" : ""}* older than 6h.\n\n` +
      `_Queue is fresh. Next cron tick will generate new content._`
    );
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
      // userId null = legacy system-wide block (Varun's account)
      const existingBlock = await prisma.blockedAccount.findFirst({ where: { userId: null, username } });
      if (!existingBlock) {
        await prisma.blockedAccount.create({ data: { username } });
      }
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

      const unread = mentions.filter((m: { id: string }) => m.id && !repliedIds.has(m.id)).slice(0, 5);

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

  // ── /waitlist ─────────────────────────────────────────────────────────────
  else if (cmd === "/waitlist") {
    try {
      const [total, recent] = await Promise.all([
        prisma.waitlist.count(),
        prisma.waitlist.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      ]);
      const lines = recent.map((w, i) => {
        const d = new Date(w.createdAt);
        const date = `${d.getDate()}/${d.getMonth() + 1}`;
        return `${i + 1}. ${w.email} · ${date}`;
      }).join("\n");
      await send(chatId,
        `*📋 Waitlist — ${total} signup${total !== 1 ? "s" : ""}*\n\n` +
        `\`\`\`\n${lines || "No signups yet."}\n\`\`\`\n\n` +
        (total > 20 ? `_Showing latest 20 of ${total}_` : "")
      );
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /leads ───────────────────────────────────────────────────────────────
  else if (cmd === "/leads") {
    try {
      const { prisma: db } = await import("@/lib/db");
      const stage = args.trim().toUpperCase() || null;
      const validStages = ["DISCOVERED", "WARMING", "DM_SENT", "RESPONDED", "CONVERTED"];

      if (stage && validStages.includes(stage)) {
        const leads = await db.leadProfile.findMany({
          where: { userId: reqUserId, stage: stage as never },
          orderBy: { warmthScore: "desc" },
          take: 10,
          select: { username: true, warmthScore: true, aiSummary: true, discoveredAt: true },
        });
        if (!leads.length) {
          await send(chatId, `No leads in *${stage}* stage.`);
        } else {
          const lines = leads.map(l =>
            `@${l.username} · score ${l.warmthScore}${l.aiSummary ? `\n_${l.aiSummary.slice(0, 80)}_` : ""}`
          ).join("\n\n");
          await send(chatId, `*${stage} leads (${leads.length}):*\n\n${lines}`);
        }
      } else {
        const groups = await db.leadProfile.groupBy({
          by: ["stage"],
          where: { userId: reqUserId },
          _count: { id: true },
        });
        const counts: Record<string, number> = {};
        for (const g of groups) counts[g.stage] = g._count.id;
        await send(chatId,
          `*🎯 Lead Pipeline*\n\n` +
          `🔍 Discovered: ${counts.DISCOVERED ?? 0}\n` +
          `🔥 Warming: ${counts.WARMING ?? 0}\n` +
          `📩 DM sent: ${counts.DM_SENT ?? 0}\n` +
          `💬 Responded: ${counts.RESPONDED ?? 0}\n` +
          `✅ Converted: ${counts.CONVERTED ?? 0}\n\n` +
          `_Use /leads warming, /leads dm\_sent, etc. to drill down_\n` +
          `_Use /lead @username for full profile_`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "🔥 Warming", callback_data: "leads_stage:WARMING" },
                { text: "📩 DM'd", callback_data: "leads_stage:DM_SENT" },
                { text: "💬 Responded", callback_data: "leads_stage:RESPONDED" },
              ]],
            },
          }
        );
      }
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── /lead @username ──────────────────────────────────────────────────────
  else if (cmd === "/lead") {
    const username = args.replace(/^@/, "").trim();
    if (!username) {
      await send(chatId, "Usage: `/lead @username`");
    } else {
      try {
        const { prisma: db } = await import("@/lib/db");
        const lead = await db.leadProfile.findFirst({
          where: { userId: reqUserId, username },
          include: { activities: { orderBy: { createdAt: "desc" }, take: 8 } },
        });
        if (!lead) {
          await send(chatId, `No lead found for @${username}`);
        } else {
          const dmHistory = (lead.dmHistory as Array<{ sent: string; at: string; replied?: boolean }> | null) ?? [];
          const actLines = lead.activities.slice(0, 5).map(a =>
            `  • ${a.type.replace(/_/g, " ")}${a.detail ? `: _${a.detail.slice(0, 50)}_` : ""}`
          ).join("\n");
          await send(chatId,
            `*@${lead.username}* · ${lead.stage} · score ${lead.warmthScore}\n\n` +
            (lead.aiSummary ? `_${lead.aiSummary}_\n\n` : "") +
            (lead.bio ? `Bio: ${lead.bio.slice(0, 150)}\n` : "") +
            (lead.notes ? `Notes: ${lead.notes}\n` : "") +
            `Source: ${lead.sourceKeyword ?? "—"} · Found ${lead.discoveredAt.toISOString().slice(0,10)}\n` +
            (actLines ? `\nActivity:\n${actLines}\n` : "") +
            (dmHistory.length ? `\nDMs sent: ${dmHistory.length}` : "\nNo DMs sent yet"),
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: "📩 Send DM", callback_data: `lead_dm:${lead.id}` },
                  { text: "✅ Converted", callback_data: `lead_convert:${lead.id}` },
                  { text: "🗑️ Remove", callback_data: `lead_remove:${lead.id}` },
                ]],
              },
            }
          );
        }
      } catch (e) {
        await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
      }
    }
  }

  // ── /icp ─────────────────────────────────────────────────────────────────
  else if (cmd === "/icp") {
    try {
      const { getICP } = await import("@/lib/leads/icp");
      const icp = await getICP(reqUserId);
      await send(chatId,
        `*🎯 ICP Config*\n\n` +
        `*Keywords:* ${icp.keywords.join(", ") || "(none)"}\n` +
        `*Competitors:* ${icp.competitorHandles.join(", ") || "(none)"}\n` +
        `*Hashtags:* ${icp.hashtags.join(", ") || "(none)"}\n` +
        `*Followers:* ${icp.minFollowers}–${icp.maxFollowers}\n` +
        `*DM threshold:* ${icp.warmthThreshold}\n\n` +
        `_To edit, just tell the Secretary: "add 'indie hacker' to my ICP keywords"_`
      );
    } catch (e) {
      await send(chatId, `❌ Error: ${String(e).slice(0, 100)}`);
    }
  }

  // ── Edit response / custom mention reply: non-command text ───────────────
  else if (!cmd.startsWith("/")) {
    // Priority 0: pending brain field edit
    const pendingBrainEdit = await prisma.queueItem.findFirst({
      where: { type: "BrainEdit", status: "PENDING", metadata: { path: ["awaitingBrainEdit"], equals: true } },
      orderBy: { createdAt: "desc" },
    });
    if (pendingBrainEdit) {
      const meta = (pendingBrainEdit.metadata as Record<string, unknown>) ?? {};
      const field = String(meta.field ?? "notes");
      try {
        await setBrainField(field, raw);
        await prisma.queueItem.update({ where: { id: pendingBrainEdit.id }, data: { status: "POSTED" } });
        await send(chatId, `✅ *Brain updated* — \`${field}\` saved.\n\n_${raw.slice(0, 200)}_`);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 100)}`);
      }
      return NextResponse.json({ ok: true });
    }

    // Priority 1: pending tweet edit
    const pendingEdit = await prisma.queueItem.findFirst({
      where: { status: "PENDING", metadata: { path: ["awaitingEdit"], equals: true } },
    });
    if (pendingEdit) {
      await send(chatId, "⚡ Posting your edited version...");
      try {
        await humanPause();
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
        await humanPause();
        await replyToTweet(String(meta.tweetId), raw);
        await prisma.queueItem.update({ where: { id: pendingMentionReply.id }, data: { status: "POSTED" } });
        await prisma.activity.create({
          data: { action: "Replied to mention", detail: `mid:${meta.tweetId}|${raw.slice(0, 70)}`, icon: "💬" },
        });
        // Record to thread memory — custom typed replies are still real exchanges
        if (meta.authorId) {
          if (meta.originalText) {
            await appendToThread(String(meta.authorId), String(meta.authorUsername ?? ""), {
              role: "them", content: String(meta.originalText), tweetId: String(meta.tweetId), at: new Date().toISOString(),
            });
          }
          await appendToThread(String(meta.authorId), String(meta.authorUsername ?? ""), {
            role: "us", content: raw, tweetId: String(meta.tweetId), at: new Date().toISOString(),
          });
        }
        await send(chatId, `✅ *Reply sent!*\n\n↩ ${raw.slice(0, 280)}`);
      } catch (e) {
        await send(chatId, `❌ Failed: ${String(e).slice(0, 120)}`);
      }
    } else {
      // ── Secretary: natural language catch-all ────────────────────────────
      // Reached only when no priority handler matched (no pending edit/reply/brain edit).
      try {
        const { handleSecretary } = await import("@/lib/secretary");
        await send(chatId, "_thinking..._");
        const reply = await handleSecretary(raw, reqUserId);
        await send(chatId, reply);
      } catch (e) {
        await send(chatId, `❌ Secretary error: ${String(e).slice(0, 120)}`);
      }
    }
  }

  return NextResponse.json({ ok: true });
  } catch (e) {
    // activeChatId/activeBotUrl are inside the try block so fall back to defaults here
    const errChatId = process.env.TELEGRAM_CHAT_ID ?? "";
    if (errChatId) {
      await fetch(`${DEFAULT_BOT}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: errChatId, text: `⚠️ Bot error: ${String(e).slice(0, 200)}` }),
      }).catch(() => null);
    }
    return NextResponse.json({ ok: true });
  }
}
