import { getLinkedInAuth, liRequest } from "./client";

const LI_MAX_CHARS = 2900; // LinkedIn limit is 3000 — leave buffer

export async function postToLinkedIn(text: string): Promise<{ id: string }> {
  const auth = await getLinkedInAuth();
  if (!auth) {
    throw new Error("LinkedIn not connected — visit /api/auth/linkedin to authorize");
  }

  const safe = text.length > LI_MAX_CHARS ? text.slice(0, LI_MAX_CHARS - 1) + "…" : text;

  const result = await liRequest("POST", "/v2/ugcPosts", auth.accessToken, {
    author: `urn:li:person:${auth.personId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: safe },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  });

  return { id: String(result.id ?? "") };
}
