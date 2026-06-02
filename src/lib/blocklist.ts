// Blocked accounts are stored in env vars — never in the repo.
// Set BLOCKED_USERNAMES=user1,user2 and BLOCKED_IDS=123,456 in .env.local / Vercel.

function getBlockedUsernames(): Set<string> {
  const raw = process.env.BLOCKED_USERNAMES ?? "";
  return new Set(raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
}

function getBlockedIds(): Set<string> {
  const raw = process.env.BLOCKED_IDS ?? "";
  return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
}

export function isBlocked(userId?: string, username?: string): boolean {
  const ids = getBlockedIds();
  const usernames = getBlockedUsernames();
  if (userId && ids.has(userId)) return true;
  if (username && usernames.has(username.toLowerCase())) return true;
  return false;
}
