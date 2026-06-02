import { xRW } from "./client";

export async function sendDM(participantId: string, text: string) {
  const dm = await xRW.v2.sendDmToParticipant(participantId, { text });
  return dm;
}

export async function getDMConversations() {
  const convos = await xRW.v2.listDmEvents({
    max_results: 20,
    "dm_event.fields": ["text", "created_at", "sender_id"],
    expansions: ["sender_id"],
  });
  return convos.data?.data ?? [];
}
