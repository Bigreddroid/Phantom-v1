import { NextResponse } from "next/server";
import { DEMO } from "@/lib/demo-data";
import { searchTweets, likeTweet, retweet, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateReply } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyPosted, sendMessage } from "@/lib/telegram/notify";
import { randomDelay } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { ensureWebhook } from "@/lib/telegram/setup";
import { NICHE_KEYWORDS } from "@/lib/config";
import { getRepliedTweetIds, getRepliedAuthorIds, buildReplyDetail } from "@/lib/reply-dedup";

function getISTHour(): number {
  return parseInt(
    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }),
    10
  );
}

export const maxDuration = 60;

// Reject off-topic content (politics, news) even if the search keyword matched tangentially
const OFFTOPIC = [
  "biden", "trump", "obama", "harris", "kamala", "pelosi",
  "congress", "senate", "republican", "democrat", "maga",
  "election", "voting", "ballot", "shooting", "arrested",
  "lawsuit", "court", "verdict", "breaking:", "breaking news",
  "just in:", "media's", "nfl", "nba", "fifa",
];
const NICHE = [
  "build", "ship", "launch", "product", "founder", "indie",
  "automat", "notion", "obsidian", "claude", "llm", "agent",
  "startup", "saas", "workflow", "content", "brand", "audience",
  "solopreneur", "phantom", "project z",
];
function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  if (OFFTOPIC.some(s => lower.includes(s))) return false;
  return NICHE.some(s => lower.includes(s));
}

// Each run randomly picks one of four engagement strategies — keeps the pattern unpredictable
type EngageMode = "like-spree" | "reply-focus" | "mixed" | "retweet-mix";

function pickMode(isDay: boolean): EngageMode {
  if (!isDay) return "like-spree"; // night window: silent likes only
  const r = Math.random();
  if (r < 0.15) return "like-spree";   // 15% — fast likes (reduced)
  if (r < 0.50) return "reply-focus";  // 35% — high reply rate (increased — builds connections)
  if (r < 0.85) return "mixed";        // 35% — like + reply balanced (increased)
  return "retweet-mix";                // 15% — retweet mix (reduced)
}

export async function GET(req: Request) {
  if (DEMO) return NextResponse.json({ ok: true, demo: true, skipped: "demo mode" });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hour = getISTHour();
  const isDay = hour >= 7 && hour < 22;
  const mode = pickMode(isDay);

  // Per-mode tuning
  const maxTweets   = mode === "like-spree" ? 20 : mode === "reply-focus" ? 6 : 10;
  const replyChance = mode === "reply-focus" ? 0.65 : mode === "mixed" ? 0.40 : mode === "retweet-mix" ? 0.25 : 0;
  const rtChance    = mode === "retweet-mix" ? 0.40 : 0;

  try {
    void ensureWebhook();

    const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
    if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();
    const keyword = NICHE_KEYWORDS[Math.floor(Math.random() * NICHE_KEYWORDS.length)];

    // Shared dedup — covers tweets replied to by engage, mentions, AND goout
    const [repliedIds, repliedAuthorIds] = await Promise.all([
      getRepliedTweetIds(),
      getRepliedAuthorIds(),
    ]);

    const [verifiedTweets, normalTweets] = await Promise.all([
      searchTweets(`${keyword} -is:retweet lang:en is:verified`, Math.ceil(maxTweets * 0.9)),
      searchTweets(`${keyword} -is:retweet lang:en -is:verified`, Math.ceil(maxTweets * 0.2)),
    ]);
    const tweets = [
      ...verifiedTweets,
      ...normalTweets.slice(0, Math.max(1, Math.floor(verifiedTweets.length / 10))),
    ].slice(0, maxTweets);

    let liked = 0, replied = 0, retweeted = 0;
    const replyErrors: string[] = [];
    const seen = new Set<string>();

    for (const tweet of tweets) {
      if (!tweet.author_id || tweet.author_id === me.id || seen.has(tweet.author_id) || isBlocked(tweet.author_id, tweet.author_username)) continue;
      if (repliedIds.has(tweet.id)) continue;
      if (tweet.author_id && repliedAuthorIds.has(tweet.author_id)) continue;
      seen.add(tweet.author_id);

      try { await likeTweet(tweet.id, me.id); liked++; } catch { /* skip */ }
      await randomDelay(800, 2000);

      // Only retweet if content is clearly on-topic
      if (rtChance > 0 && Math.random() < rtChance && isRelevant(tweet.text)) {
        try { await retweet(tweet.id, me.id); retweeted++; } catch { /* skip */ }
        await randomDelay(500, 1500);
      }

      if (isDay && replyChance > 0 && Math.random() < replyChance) {
        try {
          const reply = await generateReply(tweet.text, tweet.author_username || tweet.author_id);
          await replyToTweet(tweet.id, reply);
          replied++;
          await prisma.activity.create({
            data: { action: "Replied to tweet", detail: buildReplyDetail(tweet.id, tweet.author_id ?? "", reply), icon: "💬" },
          });
          await sendMessage(
            `💬 *Comment posted on X*\n\n` +
            `_In reply to:_ "${tweet.text.slice(0, 100)}"\n\n` +
            `*Reply:* ${reply.slice(0, 200)}`
          );
          await randomDelay(2000, 5000);
        } catch (e) {
          const msg = String(e);
          // 344 = tweet deleted before reply landed — not an error worth logging
          if (msg.includes("344") || msg.includes("No status found")) continue;
          // 403/501 = tweet restricted or not replyable — note in summary but skip DB write
          if (msg.includes("403") || msg.includes("501")) {
            replyErrors.push(`restricted:${tweet.id}`);
            continue;
          }
          replyErrors.push(msg.slice(0, 80));
          await prisma.activity.create({
            data: { action: "Reply failed", detail: msg.slice(0, 80), icon: "❌" },
          });
        }
      }
    }

    if (replyErrors.length > 0) {
      await sendMessage(`⚠️ *Engage: ${replyErrors.length} reply(s) failed*\n\`${replyErrors[0]}\``);
    }

    const modeLabel: Record<EngageMode, string> = {
      "like-spree":   "❤️ Like spree",
      "reply-focus":  "💬 Reply focus",
      "mixed":        "⚡ Mixed",
      "retweet-mix":  "🔁 Retweet mix",
    };

    await prisma.activity.create({
      data: {
        action: `Engage — ${modeLabel[mode]}`,
        detail: `❤️ ${liked} · 💬 ${replied}${retweeted > 0 ? ` · 🔁 ${retweeted}` : ""} · "${keyword}"`,
        icon: "⚡",
      },
    });

    if (liked > 0) {
      await notifyPosted(
        `Engage: ${modeLabel[mode]}`,
        `❤️ ${liked} likes · 💬 ${replied} replies${retweeted > 0 ? ` · 🔁 ${retweeted} RTs` : ""}\n"${keyword}"`
      );
    }

    return NextResponse.json({ ok: true, mode, liked, replied, retweeted, keyword });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
