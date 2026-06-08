import { prisma } from "@/lib/db";

// ── Brand memory defaults ─────────────────────────────────────────────────────
const DEFAULTS: Record<string, string> = {
  purpose:
    "Phantom is an AI system that automates X/Twitter presence for @BigRedDr0id — posting, engaging, replying, DMs — 24/7 via Telegram. Part of BigRedDroid, a solo product lab building in public.",
  voice:
    "Direct, confident, no fluff. Solo founder thinking out loud. Technical but not academic. Varies sentence length. Never sounds like a bot or a marketing post. Occasionally dry humour.",
  focus:
    "Growing Phantom waitlist. Building in public. Documenting the journey of automating personal brand at scale.",
  avoid:
    "Generic productivity takes. Corporate tone. Repeating angles already covered. Motivational filler. Overusing 'game-changer' or 'revolutionary'.",
  wins:  "",
  notes: "",
};

// ── 5-min in-memory cache (per warm serverless instance) ─────────────────────
let _cache: string | null = null;
let _cacheAt = 0;
const TTL = 5 * 60 * 1000;

// Helper: upsert a brain memory row by userId+key (safe for nullable userId)
async function upsertBrainRow(userId: string | null, key: string, value: string) {
  const existing = await prisma.brainMemory.findFirst({ where: { userId, key } });
  if (existing) {
    await prisma.brainMemory.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.brainMemory.create({ data: { userId, key, value } });
  }
}

export async function getBrainContext(userId: string | null = null): Promise<string> {
  if (userId === null && _cache && Date.now() - _cacheAt < TTL) return _cache;

  const rows = await prisma.brainMemory.findMany({ where: { userId } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  // Bootstrap missing keys with defaults (silent)
  const missing = Object.keys(DEFAULTS).filter(k => !map[k]);
  if (missing.length) {
    await Promise.all(missing.map(k => upsertBrainRow(userId, k, DEFAULTS[k])));
    for (const k of missing) map[k] = DEFAULTS[k];
  }

  const parts: string[] = [
    `[BRAND CONTEXT]`,
    `Purpose: ${map.purpose}`,
    `Voice: ${map.voice}`,
    `Focus: ${map.focus}`,
    `Avoid: ${map.avoid}`,
  ];
  if (map.wins)  parts.push(`What's working: ${map.wins}`);
  if (map.notes) parts.push(`Notes: ${map.notes}`);
  parts.push(`[/BRAND CONTEXT]`);

  const result = parts.join("\n");
  if (userId === null) { _cache = result; _cacheAt = Date.now(); }
  return result;
}

export function invalidateBrainCache() {
  _cache = null;
  _cacheAt = 0;
}

export async function getBrainFields(userId: string | null = null): Promise<Record<string, string>> {
  const rows = await prisma.brainMemory.findMany({ where: { userId } });
  const map: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setBrainField(key: string, value: string, userId: string | null = null) {
  await upsertBrainRow(userId, key, value);
  if (userId === null) invalidateBrainCache();
}

export async function resetBrainToDefaults(userId: string | null = null) {
  await Promise.all(Object.entries(DEFAULTS).map(([k, v]) => upsertBrainRow(userId, k, v)));
  if (userId === null) invalidateBrainCache();
}

// ── Conversation thread memory ────────────────────────────────────────────────

interface Message {
  role: "them" | "us";
  content: string;
  tweetId: string;
  at: string; // ISO
}

export async function getThread(
  twitterUserId: string,
  limit = 6,
  userId: string | null = null,
): Promise<Message[]> {
  const thread = await prisma.conversationThread.findFirst({
    where: { userId, twitterUserId },
  });
  if (!thread) return [];
  return ((thread.messages as unknown) as Message[]).slice(-limit);
}

export async function appendToThread(
  twitterUserId: string,
  twitterUsername: string,
  msg: Message,
  userId: string | null = null,
) {
  const existing = await prisma.conversationThread.findFirst({
    where: { userId, twitterUserId },
  });

  if (existing) {
    let messages = (existing.messages as unknown) as Message[];
    messages.push(msg);
    if (messages.length > 20) messages = messages.slice(-20);
    await prisma.conversationThread.update({
      where: { id: existing.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { messages: messages as any, twitterUsername },
    });
  } else {
    await prisma.conversationThread.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { userId, twitterUserId, twitterUsername, messages: [msg] as any },
    });
  }
}
