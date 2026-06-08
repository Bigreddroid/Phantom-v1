import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getBrainFields, setBrainField } from "@/lib/brain/context";
import { getStatsPaused } from "@/lib/user-context";

export type ToolName =
  | "get_leads" | "get_lead" | "get_brain" | "get_icp" | "get_activity" | "get_stats" | "get_queue"
  | "update_icp" | "update_brain" | "update_lead_stage" | "add_lead_note" | "queue_content" | "save_template"
  | "run_cron" | "pause_job" | "resume_job"
  | "preview_tweet" | "preview_dm";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_leads",
    description: "Get leads from the pipeline. Optionally filter by stage.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: ["DISCOVERED", "WARMING", "DM_SENT", "RESPONDED", "CONVERTED", "REMOVED"], description: "Filter by stage" },
        limit: { type: "number", description: "Max results, default 10" },
      },
    },
  },
  {
    name: "get_lead",
    description: "Get full profile, warmth score, activity history, and DM history for a specific lead by username.",
    input_schema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Twitter username without @" },
      },
      required: ["username"],
    },
  },
  {
    name: "get_brain",
    description: "Get current brain memory fields (purpose, voice, focus, avoid, wins, notes).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_icp",
    description: "Get current ICP (ideal customer profile) configuration.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_activity",
    description: "Get recent automation activity log.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results, default 20" },
      },
    },
  },
  {
    name: "get_stats",
    description: "Get current account stats: followers, following, tweets, engagements, DMs sent.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_queue",
    description: "Get pending content queue items awaiting approval.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_icp",
    description: "Update one or more fields in the ICP config. Merges with existing config.",
    input_schema: {
      type: "object",
      properties: {
        keywords: { type: "array", items: { type: "string" }, description: "Keywords to search in bios and tweets" },
        competitorHandles: { type: "array", items: { type: "string" }, description: "Competitor usernames to mine followers from" },
        hashtags: { type: "array", items: { type: "string" } },
        minFollowers: { type: "number" },
        maxFollowers: { type: "number" },
        warmthThreshold: { type: "number", description: "Score (0-100) needed to trigger a DM" },
      },
    },
  },
  {
    name: "update_brain",
    description: "Update a brain memory field (focus, voice, avoid, wins, notes, purpose).",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", enum: ["purpose", "voice", "focus", "avoid", "wins", "notes"] },
        value: { type: "string" },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "update_lead_stage",
    description: "Move a lead to a different pipeline stage.",
    input_schema: {
      type: "object",
      properties: {
        username: { type: "string" },
        stage: { type: "string", enum: ["DISCOVERED", "WARMING", "DM_SENT", "RESPONDED", "CONVERTED", "REMOVED"] },
      },
      required: ["username", "stage"],
    },
  },
  {
    name: "add_lead_note",
    description: "Add or replace notes on a lead profile.",
    input_schema: {
      type: "object",
      properties: {
        username: { type: "string" },
        note: { type: "string" },
      },
      required: ["username", "note"],
    },
  },
  {
    name: "queue_content",
    description: "Add a tweet, thread, or DM to the queue for approval.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["Tweet", "Thread", "DM"] },
        content: { type: "string", description: "For threads, separate tweets with ---" },
        metadata: { type: "object", description: "Optional metadata (withImage, targetUsername, etc.)" },
      },
      required: ["type", "content"],
    },
  },
  {
    name: "save_template",
    description: "Save a new outreach DM template.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        body: { type: "string", description: "Template body. Use {{username}} and {{topic}} for personalization." },
        category: { type: "string", description: "e.g. warm_intro, follow_up, conversion" },
      },
      required: ["name", "body"],
    },
  },
  {
    name: "run_cron",
    description: "Manually trigger a cron job. Set dryRun=true to test without side effects.",
    input_schema: {
      type: "object",
      properties: {
        job: { type: "string", description: "Job name: mentions, engage, tweet, thread, follow, dm, goout, summary, brain, prospect-discovery, warmth-scorer, lead-dm, trending-rt, niche-rt" },
        dryRun: { type: "boolean", description: "If true, returns what would happen without executing" },
      },
      required: ["job"],
    },
  },
  {
    name: "pause_job",
    description: "Pause all automation (sets paused=true in stats).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "resume_job",
    description: "Resume all automation (sets paused=false in stats).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "preview_tweet",
    description: "Generate a tweet preview without queuing it.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string" },
      },
      required: ["topic"],
    },
  },
  {
    name: "preview_dm",
    description: "Preview what DM would be sent to a lead, without actually sending it.",
    input_schema: {
      type: "object",
      properties: {
        username: { type: "string" },
      },
      required: ["username"],
    },
  },
];

interface ToolInput {
  stage?: string;
  limit?: number;
  username?: string;
  field?: string;
  value?: string;
  keywords?: string[];
  competitorHandles?: string[];
  hashtags?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  warmthThreshold?: number;
  note?: string;
  type?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  name?: string;
  body?: string;
  category?: string;
  job?: string;
  dryRun?: boolean;
  topic?: string;
}

export async function executeTool(
  toolName: ToolName,
  input: ToolInput,
  userId: string | null,
  appUrl: string,
  cronSecret: string,
): Promise<string> {
  try {
    switch (toolName) {

      case "get_leads": {
        const where = { userId, ...(input.stage ? { stage: input.stage as never } : { stage: { not: "REMOVED" as never } }) };
        const leads = await prisma.leadProfile.findMany({
          where,
          orderBy: { warmthScore: "desc" },
          take: input.limit ?? 10,
          select: { username: true, stage: true, warmthScore: true, aiSummary: true, sourceKeyword: true, discoveredAt: true },
        });
        if (!leads.length) return "No leads found.";
        return leads.map(l =>
          `@${l.username} · ${l.stage} · score ${l.warmthScore}${l.aiSummary ? `\n  ${l.aiSummary.slice(0, 120)}` : ""}`
        ).join("\n\n");
      }

      case "get_lead": {
        const lead = await prisma.leadProfile.findFirst({
          where: { userId, username: input.username },
          include: { activities: { orderBy: { createdAt: "desc" }, take: 20 } },
        });
        if (!lead) return `No lead found for @${input.username}`;
        const dmHistory = (lead.dmHistory as Array<{ sent: string; at: string; replied?: boolean }> | null) ?? [];
        const actLines = lead.activities.map(a => `  ${a.type}${a.detail ? `: ${a.detail}` : ""} (${a.createdAt.toISOString().slice(0,10)})`).join("\n");
        const dmLines = dmHistory.map(d => `  DM: "${d.sent.slice(0, 80)}" at ${d.at} — ${d.replied ? "replied ✅" : "no reply yet"}`).join("\n");
        return [
          `@${lead.username} · ${lead.stage} · warmth ${lead.warmthScore}`,
          lead.bio ? `Bio: ${lead.bio.slice(0, 150)}` : "",
          lead.aiSummary ? `Summary: ${lead.aiSummary}` : "",
          lead.notes ? `Notes: ${lead.notes}` : "",
          `Source: ${lead.sourceKeyword ?? "unknown"}`,
          actLines ? `\nActivity:\n${actLines}` : "",
          dmLines ? `\nDM History:\n${dmLines}` : "No DMs sent yet.",
        ].filter(Boolean).join("\n");
      }

      case "get_brain": {
        const brain = await getBrainFields(userId);
        return Object.entries(brain).map(([k, v]) => `${k}: ${v || "(empty)"}`).join("\n");
      }

      case "get_icp": {
        const icp = await prisma.iCPConfig.findFirst({ where: { userId } });
        if (!icp) return "ICP not configured yet. Use update_icp to set it up.";
        return [
          `Keywords: ${icp.keywords.join(", ") || "(none)"}`,
          `Competitor handles: ${icp.competitorHandles.join(", ") || "(none)"}`,
          `Hashtags: ${icp.hashtags.join(", ") || "(none)"}`,
          `Follower range: ${icp.minFollowers}–${icp.maxFollowers}`,
          `Warmth threshold: ${icp.warmthThreshold}`,
        ].join("\n");
      }

      case "get_activity": {
        const rows = await prisma.activity.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: input.limit ?? 20,
          select: { action: true, detail: true, icon: true, createdAt: true },
        });
        if (!rows.length) return "No activity recorded yet.";
        return rows.map(a =>
          `${a.icon ?? "•"} [${a.createdAt.toISOString().slice(0,10)}] ${a.action}${a.detail ? ` — ${a.detail.slice(0, 80)}` : ""}`
        ).join("\n");
      }

      case "get_stats": {
        const row = userId
          ? await prisma.stats.findFirst({ where: { userId } })
          : await prisma.stats.findUnique({ where: { id: "singleton" } });
        if (!row) return "No stats recorded yet.";
        return `Followers: ${row.followers} · Following: ${row.following} · Tweets: ${row.tweets} · Engagements: ${row.engagements} · DMs sent: ${row.dmsSent} · Paused: ${row.paused}`;
      }

      case "get_queue": {
        const items = await prisma.queueItem.findMany({
          where: { userId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, type: true, content: true, createdAt: true },
        });
        if (!items.length) return "No pending queue items.";
        return items.map(q =>
          `[${q.type}] ${q.content.slice(0, 120)} (queued ${q.createdAt.toISOString().slice(0,10)})`
        ).join("\n\n");
      }

      case "update_icp": {
        const existing = await prisma.iCPConfig.findFirst({ where: { userId } });
        const data = {
          ...(input.keywords !== undefined && { keywords: input.keywords }),
          ...(input.competitorHandles !== undefined && { competitorHandles: input.competitorHandles }),
          ...(input.hashtags !== undefined && { hashtags: input.hashtags }),
          ...(input.minFollowers !== undefined && { minFollowers: input.minFollowers }),
          ...(input.maxFollowers !== undefined && { maxFollowers: input.maxFollowers }),
          ...(input.warmthThreshold !== undefined && { warmthThreshold: input.warmthThreshold }),
        };
        if (existing) {
          await prisma.iCPConfig.update({ where: { id: existing.id }, data });
        } else {
          await prisma.iCPConfig.create({ data: {
            userId,
            keywords: input.keywords ?? [],
            competitorHandles: input.competitorHandles ?? [],
            hashtags: input.hashtags ?? [],
            ...(input.minFollowers !== undefined && { minFollowers: input.minFollowers }),
            ...(input.maxFollowers !== undefined && { maxFollowers: input.maxFollowers }),
            ...(input.warmthThreshold !== undefined && { warmthThreshold: input.warmthThreshold }),
          }});
        }
        return `ICP updated: ${Object.keys(data).join(", ")}`;
      }

      case "update_brain": {
        await setBrainField(input.field!, input.value!, userId);
        return `Brain field "${input.field}" updated.`;
      }

      case "update_lead_stage": {
        const lead = await prisma.leadProfile.findFirst({ where: { userId, username: input.username } });
        if (!lead) return `No lead found for @${input.username}`;
        await prisma.leadProfile.update({ where: { id: lead.id }, data: { stage: input.stage as never } });
        await prisma.leadActivity.create({ data: { leadId: lead.id, type: "stage_changed", detail: `→ ${input.stage}` } });
        return `@${input.username} moved to ${input.stage}.`;
      }

      case "add_lead_note": {
        const lead = await prisma.leadProfile.findFirst({ where: { userId, username: input.username } });
        if (!lead) return `No lead found for @${input.username}`;
        await prisma.leadProfile.update({ where: { id: lead.id }, data: { notes: input.note } });
        return `Note saved for @${input.username}.`;
      }

      case "queue_content": {
        const item = await prisma.queueItem.create({
          data: {
            userId,
            type: input.type!,
            content: input.content!,
            metadata: (input.metadata ?? {}) as never,
            status: "PENDING",
          },
        });
        return `Queued ${input.type} (id: ${item.id}). It will appear in Telegram for approval.`;
      }

      case "save_template": {
        const tmpl = await prisma.outreachTemplate.create({
          data: {
            userId,
            name: input.name!,
            body: input.body!,
            category: input.category ?? null,
          },
        });
        return `Template "${tmpl.name}" saved (id: ${tmpl.id}).`;
      }

      case "run_cron": {
        const validJobs = ["mentions","engage","tweet","thread","follow","dm","goout","summary","brain","prospect-discovery","warmth-scorer","lead-dm","trending-rt","niche-rt","longpost","resurface","watchdog"];
        if (!validJobs.includes(input.job!)) return `Unknown job "${input.job}". Valid: ${validJobs.join(", ")}`;
        if (input.dryRun) return `Dry run: would hit /api/cron/${input.job}${userId ? `?userId=${userId}` : ""}`;
        const sep = userId ? "?" : "";
        const qs = userId ? `userId=${userId}` : "";
        const res = await fetch(`${appUrl}/api/cron/${input.job}${sep}${qs}`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        }).catch(e => ({ ok: false, statusText: String(e) })) as Response;
        return res.ok ? `Job "${input.job}" triggered successfully.` : `Job failed: ${res.statusText}`;
      }

      case "pause_job": {
        await (userId
          ? prisma.stats.updateMany({ where: { userId }, data: { paused: true } })
          : prisma.stats.update({ where: { id: "singleton" }, data: { paused: true } })
        );
        return "Automation paused.";
      }

      case "resume_job": {
        await (userId
          ? prisma.stats.updateMany({ where: { userId }, data: { paused: false } })
          : prisma.stats.update({ where: { id: "singleton" }, data: { paused: false } })
        );
        return "Automation resumed.";
      }

      case "preview_tweet": {
        const { generateTweet } = await import("@/lib/claude/generate");
        const tweet = await generateTweet(input.topic!);
        return `Preview tweet:\n\n"${tweet}"`;
      }

      case "preview_dm": {
        const lead = await prisma.leadProfile.findFirst({
          where: { userId, username: input.username },
          include: { activities: { orderBy: { createdAt: "desc" }, take: 5 } },
        });
        if (!lead) return `No lead found for @${input.username}`;
        const { generateDM } = await import("@/lib/claude/generate");
        const context = lead.aiSummary ?? `@${lead.username} — ${lead.bio ?? "no bio"}`;
        const dm = await generateDM(input.username!, context);
        return `Preview DM to @${input.username}:\n\n"${dm}"`;
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (e) {
    return `Tool error: ${String(e).slice(0, 200)}`;
  }
}
