import { prisma } from "@/lib/db";

// All reply actions tracked across every cron
const REPLY_ACTIONS = ["Replied to tweet", "Replied to mention", "Auto comment dropped"] as const;

// tweet IDs we have already replied to — ALL TIME for mentions, 30 days for engage/goout
export async function getRepliedTweetIds(allTime = false): Promise<Set<string>> {
  const rows = await prisma.activity.findMany({
    where: {
      action: { in: [...REPLY_ACTIONS] },
      ...(allTime ? {} : { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }),
    },
    select: { detail: true },
    take: 50000,
  });
  const ids = new Set<string>();
  for (const r of rows) {
    const id = r.detail?.match(/^tid:(\w+)/)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

// author IDs we have already engaged with in the last 7 days (from any cron)
export async function getRepliedAuthorIds(): Promise<Set<string>> {
  const rows = await prisma.activity.findMany({
    where: {
      action: { in: [...REPLY_ACTIONS] },
      createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
    select: { detail: true },
    take: 10000,
  });
  const ids = new Set<string>();
  for (const r of rows) {
    const id = r.detail?.match(/\|aid:(\w+)/)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

// Standard detail format: "tid:<tweetId>|aid:<authorId>|<first 60 chars of reply>"
export function buildReplyDetail(tweetId: string, authorId: string, replyText: string): string {
  return `tid:${tweetId}|aid:${authorId}|${replyText.slice(0, 60)}`;
}
