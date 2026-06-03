import { getXClient } from "./client";

export async function sendDM(participantId: string, text: string) {
  const scraper = await getXClient();
  // agent-twitter-client uses cookie-based DM sending
  return (scraper as unknown as {
    sendDm: (userId: string, text: string) => Promise<unknown>;
  }).sendDm(participantId, text);
}

export async function getDMConversations() {
  // Not available via cookie-based scraper — return empty
  return [];
}
