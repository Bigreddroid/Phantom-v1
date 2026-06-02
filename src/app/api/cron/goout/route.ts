import { NextResponse } from "next/server";
import { searchTweets, likeTweet, getMyProfile } from "@/lib/x/engage";
import { replyToTweet } from "@/lib/x/post";
import { generateGoOutComment } from "@/lib/claude/generate";
import { prisma } from "@/lib/db";
import { notifyError, sendMessage } from "@/lib/telegram/notify";
import { shouldSkip, isActiveHour, randomDelay, humanPause } from "@/lib/scheduler/humanize";
import { loadBlocklist } from "@/lib/blocklist";
import { NICHE_KEYWORDS } from "@/lib/config";

export const maxDuration = 60;

// AI/automation-focused comment targets
const GOOUT_KEYWORDS = [
  "AI automation founders",
  "building in public tools",
  "solopreneur AI workflow",
  "personal brand AI",
  "automating content creation",
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pauseState = await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  if (pauseState?.paused) return NextResponse.json({ skipped: true, reason: "paused" });

  if (!isActiveHour() || shouldSkip(0.3)) return NextResponse.json({ skipped: true });

  await humanPause();

  try {
    const isBlocked = await loadBlocklist();
    const me = await getMyProfile();

    const allKeywords = [...GOOUT_KEYWORDS, ...NICHE_KEYWORDS.slice(0, 3)];
    const keyword = allKeywords[Math.floor(Math.random() * allKeywords.length)];

    const tweets = await searchTweets(`${keyword} -is:retweet lang:en`, 15);

    // Only comment on posts with real traction — high-visibility threads
    const targets = tweets
      .filter(t =>
        t.author_id &&
        t.author_id !== me.id &&
        !isBlocked(t.author_id, t.author_username)
      )
      .map(t => ({
        ...t,
        score: (t.public_metrics?.like_count ?? 0)
          + (t.public_metrics?.retweet_count ?? 0) * 4
          + (t.public_metrics?.reply_count ?? 0) * 2,
      }))
      .filter(t => t.score >= 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // max 3 comments per run to stay human

    if (!targets.length) {
      return NextResponse.json({ skipped: true, reason: "no high-traction targets found" });
    }

    const comments: Array<{ original: string; reply: string }> = [];
    const errors: string[] = [];

    for (const tweet of targets) {
      try {
        await likeTweet(tweet.id, me.id);
        await randomDelay(800, 2000);

        const reply = await generateGoOutComment(tweet.text);
        await replyToTweet(tweet.id, reply);
        comments.push({ original: tweet.text.slice(0, 100), reply });

        await prisma.activity.create({
          data: { action: "Auto comment dropped", detail: reply.slice(0, 80), icon: "🗣️" },
        });
        await sendMessage(
          `🗣️ *Auto-comment posted*\n\n` +
          `_"${tweet.text.slice(0, 120)}"_\n\n` +
          `↩ ${reply}\n\n` +
          `❤️ ${tweet.public_metrics?.like_count ?? 0} · 🔁 ${tweet.public_metrics?.retweet_count ?? 0}`
        );
        await randomDelay(3000, 6000);
      } catch (e) {
        errors.push(String(e).slice(0, 80));
      }
    }

    await prisma.activity.create({
      data: { action: "Auto go-out run", detail: `🗣️ ${comments.length} comments · "${keyword}"`, icon: "🗣️" },
    });

    return NextResponse.json({ ok: true, comments: comments.length, keyword, errors });
  } catch (e) {
    await notifyError("Auto goout cron", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
