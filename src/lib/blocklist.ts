// Accounts to never engage with, follow, or reply to.
// Add Twitter user IDs or usernames here.
// To find a user ID: https://tweeterid.com
const BLOCKED_USERNAMES = new Set<string>([
  // Add usernames below (without @):
  // "username1",
  // "username2",
]);

const BLOCKED_IDS = new Set<string>([
  // Add numeric Twitter user IDs below:
]);

export function isBlocked(userId?: string, username?: string): boolean {
  if (userId && BLOCKED_IDS.has(userId)) return true;
  if (username && BLOCKED_USERNAMES.has(username.toLowerCase())) return true;
  return false;
}
