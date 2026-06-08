import { getXClient } from "./client";
import { getMyProfile } from "./engage";
import type { Scraper } from "agent-twitter-client";

export async function sendDM(participantId: string, text: string, opts?: { wClient?: Scraper; myUserId?: string }) {
  const scraper = opts?.wClient ?? await getXClient();
  // Resolve our own user ID (X_USER_ID env var preferred, profile fallback)
  let myId = opts?.myUserId ?? process.env.X_USER_ID ?? "";
  if (!myId) {
    const me = await getMyProfile();
    myId = me.id;
  }
  if (!myId) throw new Error("Cannot determine own X user ID — set X_USER_ID env var");
  // X conversation IDs are always "{smallerId}-{largerId}" (numeric sort by value)
  const [a, b] = myId.length !== participantId.length
    ? [myId, participantId].sort((x, y) => x.length - y.length)
    : [myId, participantId].sort();
  const conversationId = `${a}-${b}`;
  return (scraper as unknown as {
    sendDirectMessage: (conversationId: string, text: string) => Promise<unknown>;
  }).sendDirectMessage(conversationId, text);
}

export async function getDMConversations() {
  // Not available via cookie-based scraper — return empty
  return [];
}
