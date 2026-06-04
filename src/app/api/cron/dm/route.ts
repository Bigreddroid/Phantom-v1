import { NextResponse } from "next/server";
import { searchTweets, getMyProfile } from "@/lib/x/engage";
import { generateDM } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyError } from "@/lib/telegram/notify";
import { humanPause } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Keywords for finding active builders who'd make good Phantom beta testers + feedback givers
const DM_TARGET_KEYWORDS = [
  "building in public",
  "shipped today",
  "solopreneur",
  "indie hacker",
  "founder product",
  "side project launched",
  "what I built this week",
  "AI automation tools",
  "building my startup",
  "solo founder",
  "just launched",
  "working on a product",
  "content creation workflow",
  "shipping products alone",
];

export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  await humanPause();

  try {
    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();

    // Pick a targeted keyword
    const allKeywords = [...DM_TARGET_KEYWORDS, ...NICHE_KEYWORDS.slice(0, 3)];
    const keyword = allKeywords[Math.floor(Math.random() * allKeywords.length)];

    // Find people posting relevant content with real traction
    const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 20);

    const candidates = tweets
      .filter(t =>
        t.author_id &&
        t.author_id !== me.id &&
        !isBlocked(t.author_id, t.author_username)
      )
      .map(t => ({
        ...t,
        score: (t.public_metrics?.like_count ?? 0)
          + (t.public_metrics?.retweet_count ?? 0) * 3
          + (t.public_metrics?.reply_count ?? 0),
      }))
      .filter(t => t.score >= 5 && t.author_username)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) {
      return NextResponse.json({ skipped: true, reason: "no suitable DM targets found" });
    }

    // Queue 2 candidates per run so ~10 DMs/day reach Telegram for approval
    const picked = candidates.slice(0, Math.min(candidates.length, 5));
    const targets = [
      picked[Math.floor(Math.random() * picked.length)],
      picked[Math.floor(Math.random() * picked.length)],
    ].filter((t, i, arr) => arr.findIndex(x => x.author_id === t.author_id) === i); // dedupe

    const queued: string[] = [];
    for (const target of targets) {
      const context = `active builder/founder, tweets about ${keyword} — recent post: "${target.text.slice(0, 120)}" — reach out asking if they'd try Phantom and give feedback, not to pitch them`;
      const dmText = await generateDM(target.author_username, context);

      const item = await prisma.queueItem.create({
        data: {
          type: "DM",
          content: dmText,
          metadata: {
            targetUsername: target.author_username,
            targetId: target.author_id,
            tweetId: target.id,
            keyword,
            cron: true,
          },
        },
      });

      const stats = `❤️ ${target.public_metrics?.like_count ?? 0} · 🔁 ${target.public_metrics?.retweet_count ?? 0}`;

      await fetch(`${BOT}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text:
            `*📨 Send this DM?*\n\n` +
            `To: @${target.author_username} · ${stats}\n` +
            `Their post: _"${target.text.slice(0, 150)}"_\n\n` +
            `*DM:*\n\`\`\`\n${dmText}\n\`\`\`\n\n` +
            `_ID: \`${item.id}\`_`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Send DM",  callback_data: `approve_dm:${item.id}` },
              { text: "✏️ Edit",    callback_data: `edit:${item.id}` },
              { text: "❌ Skip",    callback_data: `reject:${item.id}` },
            ]],
          },
        }),
      });

      queued.push(target.author_username);
    }

    return NextResponse.json({ ok: true, queued: queued.length, targets: queued });
  } catch (e) {
    await notifyError("Auto DM cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
