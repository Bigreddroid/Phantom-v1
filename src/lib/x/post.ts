import { getXClient } from "./client";
import { xRW } from "./client";
import { EUploadMimeType } from "twitter-api-v2";
import { pickTemplate } from "./templates";

// ── Helper: extract tweet ID from agent-twitter-client response ──────────────
async function extractTweetId(res: Response): Promise<string> {
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const createTweet = data?.create_tweet as Record<string, unknown> | undefined;
  const tweetResults = createTweet?.tweet_results as Record<string, unknown> | undefined;
  const result = tweetResults?.result as Record<string, unknown> | undefined;
  const id = result?.rest_id as string | undefined;
  if (id) return id;
  throw new Error(`Unexpected tweet response: ${JSON.stringify(json).slice(0, 200)}`);
}

export async function postTweet(text: string): Promise<{ id: string }> {
  const client = await getXClient();
  const res = await client.sendTweet(text);
  const id = await extractTweetId(res);
  return { id };
}

export async function postTweetWithImage(text: string): Promise<{ id: string; hasImage: boolean }> {
  try {
    const useTemplate = Math.random() < 0.7;
    let imgBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    if (useTemplate) {
      imgBuffer = pickTemplate(text);
    }

    if (!imgBuffer) {
      const ogUrl = `${process.env.NEXTAUTH_URL}/api/og?text=${encodeURIComponent(text.slice(0, 220))}`;
      const imgRes = await fetch(ogUrl, { signal: AbortSignal.timeout(8000) });
      if (imgRes.ok) {
        imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        mimeType = "image/png";
      }
    }

    const client = await getXClient();
    if (imgBuffer) {
      const res = await client.sendTweet(text, undefined, [{ data: imgBuffer, mediaType: mimeType }]);
      const id = await extractTweetId(res);
      return { id, hasImage: true };
    }

    const res = await client.sendTweet(text);
    const id = await extractTweetId(res);
    return { id, hasImage: false };
  } catch {
    // Fallback: post without image
    const client = await getXClient();
    const res = await client.sendTweet(text);
    const id = await extractTweetId(res);
    return { id, hasImage: false };
  }
}

export async function replyToTweet(tweetId: string, text: string): Promise<{ id: string }> {
  const safe = text.length > 275 ? text.slice(0, 272) + "…" : text;
  const client = await getXClient();
  const res = await client.sendTweet(safe, tweetId);
  const id = await extractTweetId(res);
  return { id };
}

export async function quoteTweet(tweetId: string, text: string): Promise<{ id: string }> {
  const client = await getXClient();
  // agent-twitter-client sendQuoteTweet
  const res = await (client as unknown as {
    sendQuoteTweet: (text: string, quotedTweetId: string) => Promise<Response>;
  }).sendQuoteTweet(text, tweetId);
  const id = await extractTweetId(res);
  return { id };
}

export async function deleteTweet(tweetId: string) {
  // Fallback to official API for delete (requires write scope)
  try {
    return await xRW.v2.deleteTweet(tweetId);
  } catch {
    return null;
  }
}

// imageMode: "none" | "first" | "all"
export async function postThread(
  tweets: string[],
  imageMode: "none" | "first" | "all" = "none"
): Promise<Array<{ id: string; hasImage?: boolean }>> {
  const client = await getXClient();
  const posted: Array<{ id: string; hasImage?: boolean }> = [];
  let lastId: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i];
    const wantsImage = imageMode === "all" || (imageMode === "first" && i === 0);

    let imgBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";
    if (wantsImage) {
      imgBuffer = pickTemplate(text);
      if (!imgBuffer) {
        try {
          const ogUrl = `${process.env.NEXTAUTH_URL}/api/og?text=${encodeURIComponent(text.slice(0, 220))}`;
          const imgRes = await fetch(ogUrl, { signal: AbortSignal.timeout(8000) });
          if (imgRes.ok) { imgBuffer = Buffer.from(await imgRes.arrayBuffer()); mimeType = "image/png"; }
        } catch { /* skip image */ }
      }
    }

    const mediaData = imgBuffer ? [{ data: imgBuffer, mediaType: mimeType }] : undefined;
    const res = await client.sendTweet(text, lastId, mediaData);
    const id = await extractTweetId(res);
    posted.push({ id, hasImage: !!imgBuffer });
    lastId = id;
  }

  return posted;
}
