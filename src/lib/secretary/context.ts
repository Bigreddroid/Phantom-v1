import { prisma } from "@/lib/db";
import { getBrainFields } from "@/lib/brain/context";
import { getStatsPaused } from "@/lib/user-context";

export interface SecretaryContext {
  userId: string | null;
  brain: Record<string, string>;
  icp: {
    keywords: string[];
    competitorHandles: string[];
    hashtags: string[];
    minFollowers: number;
    maxFollowers: number;
    warmthThreshold: number;
  } | null;
  pipeline: {
    DISCOVERED: number;
    WARMING: number;
    DM_SENT: number;
    RESPONDED: number;
    CONVERTED: number;
  };
  recentActivity: Array<{ action: string; detail: string | null; icon: string | null; createdAt: Date }>;
  pendingQueue: Array<{ id: string; type: string; content: string }>;
  stats: { followers: number; following: number; tweets: number; engagements: number; dmsSent: number } | null;
  paused: boolean;
}

export async function loadSecretaryContext(userId: string | null): Promise<SecretaryContext> {
  const [brain, icpRow, pipelineGroups, recentActivity, pendingQueue, statsRow, paused] = await Promise.all([
    getBrainFields(userId),
    prisma.iCPConfig.findFirst({ where: { userId } }).catch(() => null),
    prisma.leadProfile.groupBy({
      by: ["stage"],
      where: { userId },
      _count: { id: true },
    }).catch(() => []),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, detail: true, icon: true, createdAt: true },
    }),
    prisma.queueItem.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, content: true },
    }),
    (userId
      ? prisma.stats.findFirst({ where: { userId }, select: { followers: true, following: true, tweets: true, engagements: true, dmsSent: true } })
      : prisma.stats.findUnique({ where: { id: "singleton" }, select: { followers: true, following: true, tweets: true, engagements: true, dmsSent: true } })
    ).catch(() => null),
    getStatsPaused(userId),
  ]);

  const pipeline = { DISCOVERED: 0, WARMING: 0, DM_SENT: 0, RESPONDED: 0, CONVERTED: 0 };
  for (const g of pipelineGroups) {
    const stage = g.stage as keyof typeof pipeline;
    if (stage in pipeline) pipeline[stage] = g._count.id;
  }

  return {
    userId,
    brain,
    icp: icpRow ? {
      keywords: icpRow.keywords,
      competitorHandles: icpRow.competitorHandles,
      hashtags: icpRow.hashtags,
      minFollowers: icpRow.minFollowers,
      maxFollowers: icpRow.maxFollowers,
      warmthThreshold: icpRow.warmthThreshold,
    } : null,
    pipeline,
    recentActivity,
    pendingQueue,
    stats: statsRow ?? null,
    paused,
  };
}

export function formatContextForClaude(ctx: SecretaryContext): string {
  const lines: string[] = ["[SYSTEM STATE]"];

  lines.push(`Paused: ${ctx.paused}`);

  if (ctx.stats) {
    lines.push(`Stats: ${ctx.stats.followers} followers · ${ctx.stats.following} following · ${ctx.stats.tweets} tweets · ${ctx.stats.engagements} engagements · ${ctx.stats.dmsSent} DMs sent`);
  }

  lines.push(`\nBrain Memory:`);
  for (const [k, v] of Object.entries(ctx.brain)) {
    if (v) lines.push(`  ${k}: ${v.slice(0, 200)}`);
  }

  lines.push(`\nLead Pipeline: ${ctx.pipeline.DISCOVERED} discovered · ${ctx.pipeline.WARMING} warming · ${ctx.pipeline.DM_SENT} DM sent · ${ctx.pipeline.RESPONDED} responded · ${ctx.pipeline.CONVERTED} converted`);

  if (ctx.icp) {
    lines.push(`\nICP Config: keywords=[${ctx.icp.keywords.join(", ")}] competitors=[${ctx.icp.competitorHandles.join(", ")}] warmthThreshold=${ctx.icp.warmthThreshold}`);
  } else {
    lines.push(`\nICP Config: not set`);
  }

  if (ctx.pendingQueue.length > 0) {
    lines.push(`\nPending Queue (${ctx.pendingQueue.length} items):`);
    ctx.pendingQueue.forEach(q => lines.push(`  [${q.type}] ${q.content.slice(0, 80)}`));
  }

  if (ctx.recentActivity.length > 0) {
    lines.push(`\nRecent Activity (last ${ctx.recentActivity.length}):`);
    ctx.recentActivity.slice(0, 10).forEach(a =>
      lines.push(`  ${a.icon ?? "•"} ${a.action}${a.detail ? `: ${a.detail.slice(0, 80)}` : ""}`)
    );
  }

  lines.push("[/SYSTEM STATE]");
  return lines.join("\n");
}
