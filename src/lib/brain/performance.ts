import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getBrainFields, setBrainField, invalidateBrainCache } from "./context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface BrainUpdate {
  focus?: string;
  wins?: string;
  avoid?: string;
  notes?: string;
}

interface AnalysisResult {
  insights: string[];
  updates: BrainUpdate;
  diff: string[]; // human-readable list of what changed
}

export async function analyzePerformance(userId: string | null = null): Promise<AnalysisResult> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [activities, currentBrain] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    getBrainFields(userId),
  ]);

  if (activities.length < 10) {
    return { insights: [], updates: {}, diff: [] };
  }

  // Build activity summary
  const counts: Record<string, number> = {};
  for (const a of activities) {
    const key = a.action.split("—")[0].trim().split(":")[0].trim();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const activitySummary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v}× ${k}`)
    .join(", ");

  const postedContent = activities
    .filter(a => ["🐦", "🧵", "✅", "📝", "💬"].includes(a.icon ?? ""))
    .slice(0, 40)
    .map(a => `[${a.icon}] ${a.action}: "${a.detail?.slice(0, 100) ?? ""}"`)
    .join("\n");

  const prompt = `You are the strategic brain of @BigRedDr0id's Phantom automation system on X/Twitter.

CURRENT BRAIN STATE:
Purpose: ${currentBrain.purpose}
Voice: ${currentBrain.voice}
Focus: ${currentBrain.focus}
Avoid: ${currentBrain.avoid}
Current wins: ${currentBrain.wins || "none recorded yet"}
Notes: ${currentBrain.notes || "none"}

LAST 30 DAYS ACTIVITY (${activities.length} actions):
Summary: ${activitySummary}

Recent posted content and replies:
${postedContent}

---

Analyze this data deeply. Reason through what's working, what angles are getting traction, what content types are underperforming, and where the account should shift focus.

Then respond with ONLY a valid JSON object in this exact shape:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "focus": "updated focus statement based on what's working — 1-2 sentences",
  "wins": "3-5 specific observations about what's performing well",
  "avoid": "updated list of what to avoid based on patterns that aren't working",
  "notes": "any strategic observations worth remembering for next analysis"
}

Be specific and evidence-based. No generic advice. If a field doesn't need changing, keep it identical to the current value.`;

  // Use Opus with extended thinking for deep autonomous analysis
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 10000,
    thinking: { type: "enabled", budget_tokens: 8000 },
    messages: [{ role: "user", content: prompt }],
  });

  // Extract only text blocks (skip raw thinking tokens)
  const rawText = msg.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  // Parse the JSON response
  let parsed: { insights?: string[]; focus?: string; wins?: string; avoid?: string; notes?: string };
  try {
    // Find the last complete JSON object in the response (Opus sometimes adds preamble text)
    let jsonStr = "";
    let depth = 0;
    let start = -1;
    for (let i = 0; i < rawText.length; i++) {
      if (rawText[i] === "{") { if (depth === 0) start = i; depth++; }
      else if (rawText[i] === "}") { depth--; if (depth === 0 && start !== -1) jsonStr = rawText.slice(start, i + 1); }
    }
    parsed = jsonStr ? JSON.parse(jsonStr) : {};
  } catch {
    parsed = {};
  }

  const insights = (parsed.insights ?? []).slice(0, 3);
  const updates: BrainUpdate = {};
  const diff: string[] = [];

  // Only update fields that actually changed
  const fields: Array<keyof BrainUpdate> = ["focus", "wins", "avoid", "notes"];
  for (const field of fields) {
    const newVal = parsed[field]?.trim();
    if (newVal && newVal !== currentBrain[field]) {
      updates[field] = newVal;
      diff.push(`*${field}* updated`);
    }
  }

  // Apply updates to DB and bust cache
  if (Object.keys(updates).length > 0) {
    await Promise.all(
      Object.entries(updates).map(([k, v]) => setBrainField(k, v as string, userId))
    );
    if (userId === null) invalidateBrainCache();
  }

  // Store insights
  if (insights.length > 0) {
    await prisma.performanceInsight.createMany({
      data: insights.map(insight => ({ userId, insight })),
    });
  }

  return { insights, updates, diff };
}

export async function getInsights(limit = 10) {
  return prisma.performanceInsight.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { insight: true, createdAt: true },
  });
}
