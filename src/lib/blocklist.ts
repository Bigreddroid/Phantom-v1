import { prisma } from "./db";

function getBlockedUsernames(): Set<string> {
  const raw = process.env.BLOCKED_USERNAMES ?? "";
  return new Set(raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
}

function getBlockedIds(): Set<string> {
  const raw = process.env.BLOCKED_IDS ?? "";
  return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
}

// Sync check — env vars only. Use loadBlocklist() for full DB+env check.
export function isBlocked(userId?: string, username?: string): boolean {
  const ids = getBlockedIds();
  const usernames = getBlockedUsernames();
  if (userId && ids.has(userId)) return true;
  if (username && usernames.has(username.toLowerCase())) return true;
  return false;
}

// Async — merges env vars + DB. Pre-load once per request, use synchronously in loops.
export async function loadBlocklist(): Promise<(userId?: string, username?: string) => boolean> {
  const envIds = getBlockedIds();
  const envUsernames = getBlockedUsernames();

  let dbUsernames: Set<string> = new Set();
  try {
    const rows = await prisma.blockedAccount.findMany({ select: { username: true } });
    dbUsernames = new Set(rows.map(r => r.username.toLowerCase()));
  } catch { /* table may not exist yet before first migration */ }

  const allUsernames = new Set([...envUsernames, ...dbUsernames]);

  return (userId?: string, username?: string) => {
    if (userId && envIds.has(userId)) return true;
    if (username && allUsernames.has(username.toLowerCase())) return true;
    return false;
  };
}
