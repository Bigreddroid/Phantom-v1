import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type LeadStageType = "DISCOVERED" | "WARMING" | "DM_SENT" | "RESPONDED" | "CONVERTED" | "REMOVED";

export interface DmEntry {
  sent: string;
  at: string;
  replied?: boolean;
  replyText?: string;
}

// Generate a brief AI summary of a prospect from their bio + recent tweets
export async function generateLeadSummary(username: string, bio: string, recentTweets: string[]): Promise<string> {
  const tweetSample = recentTweets.slice(0, 5).map((t, i) => `${i + 1}. "${t.slice(0, 120)}"`).join("\n");
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Summarize this X user in 1-2 sentences for lead qualification. Focus on: what they do, their niche, audience size signals, and why they might need AI automation tools.

@${username}
Bio: ${bio || "(no bio)"}
Recent tweets:
${tweetSample || "(none available)"}

Reply with ONLY the 1-2 sentence summary. No preamble.`,
      }],
    });
    return (msg.content[0] as { text: string }).text.trim();
  } catch {
    return bio?.slice(0, 200) ?? "";
  }
}

// Upsert a lead — creates if new, skips if already exists
export async function upsertLead(
  userId: string | null,
  twitterUserId: string,
  username: string,
  bio: string,
  recentTweets: string[],
  sourceKeyword: string,
): Promise<{ isNew: boolean }> {
  const existing = await prisma.leadProfile.findFirst({ where: { userId, twitterUserId } });
  if (existing) return { isNew: false };

  const aiSummary = await generateLeadSummary(username, bio, recentTweets);

  await prisma.leadProfile.create({
    data: {
      userId,
      twitterUserId,
      username,
      bio: bio.slice(0, 300),
      recentTweets: recentTweets.slice(0, 10),
      aiSummary,
      sourceKeyword,
      stage: "DISCOVERED",
      warmthScore: 0,
    },
  });

  return { isNew: true };
}

// Warmth scoring — called hourly by warmth-scorer cron
// Points: followed back +20, liked your tweet +15 (per like, max 3), replied to you +20, you replied to them +10
// Decay: -2 per day since last interaction
export async function recalculateWarmth(leadId: string): Promise<number> {
  const activities = await prisma.leadActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });

  if (!activities.length) return 0;

  let score = 0;
  const now = Date.now();
  let likeCount = 0;

  for (const a of activities) {
    switch (a.type) {
      case "followed_back":   score += 20; break;
      case "liked_your_tweet":
        if (likeCount < 3) { score += 15; likeCount++; }
        break;
      case "replied_to_you":  score += 20; break;
      case "you_replied":     score += 10; break;
      case "dm_sent":         score += 5;  break;
    }
  }

  // Decay: -2 per day since most recent signal
  const lastAt = activities[0].createdAt.getTime();
  const daysSinceLast = Math.floor((now - lastAt) / (1000 * 60 * 60 * 24));
  score = Math.max(0, score - daysSinceLast * 2);

  return Math.min(score, 100);
}

export async function logLeadActivity(leadId: string, type: string, detail?: string) {
  await prisma.leadActivity.create({ data: { leadId, type, detail } });
}

export async function appendDmHistory(leadId: string, entry: DmEntry) {
  const lead = await prisma.leadProfile.findUnique({ where: { id: leadId }, select: { dmHistory: true } });
  const history = (lead?.dmHistory as DmEntry[] | null) ?? [];
  history.push(entry);
  await prisma.leadProfile.update({ where: { id: leadId }, data: { dmHistory: history as never } });
}

export async function getLeadsByStage(userId: string | null, stage: LeadStageType, limit = 20) {
  return prisma.leadProfile.findMany({
    where: { userId, stage },
    orderBy: { warmthScore: "desc" },
    take: limit,
  });
}
