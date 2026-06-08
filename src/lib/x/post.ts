import { getXClient } from "./client";
import { xRW } from "./client";
import type { Scraper } from "agent-twitter-client";
import { EUploadMimeType } from "twitter-api-v2";
import { pickTemplate, pickTemplateByStyle } from "./templates";
import { randomDelay } from "@/lib/scheduler/humanize";

// ── Helper: extract tweet ID from agent-twitter-client response ──────────────
async function extractTweetId(res: Response): Promise<string> {
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;

  // Surface Twitter API errors before checking for a tweet ID
  const errors = json.errors as Array<{ code?: number; message?: string }> | undefined;
  if (errors?.length) {
    const first = errors[0];
    const code = first?.code;
    // 226 = automated-content / duplicate block — not a hard failure for us,
    // but the post didn't go through, so throw so callers can handle it
    if (code === 226) throw new Error(`Twitter blocked post (code 226 — automated/duplicate content)`);
    throw new Error(`Twitter API error ${code ?? "?"}: ${first?.message ?? JSON.stringify(errors).slice(0, 120)}`);
  }

  const data = json.data as Record<string, unknown> | undefined;
  const createTweet = data?.create_tweet as Record<string, unknown> | undefined;
  const tweetResults = createTweet?.tweet_results as Record<string, unknown> | undefined;
  const result = tweetResults?.result as Record<string, unknown> | undefined;
  const id = result?.rest_id as string | undefined;
  if (id) return id;
  // X sometimes returns tweet_results: {} — treat as success
  if (tweetResults !== undefined) return "";
  // X sometimes returns create_tweet without tweet_results at all — still success
  if (createTweet !== undefined) return "";
  throw new Error(`Unexpected tweet response: ${JSON.stringify(json).slice(0, 200)}`);
}

export function isDailyLimitError(err: unknown): boolean {
  return String(err).includes("Twitter API error 344");
}

export async function postTweet(text: string): Promise<{ id: string }> {
  const client = await getXClient();
  const res = await client.sendTweet(text);
  const id = await extractTweetId(res);
  return { id };
}

export async function postTweetWithImage(text: string, style?: string): Promise<{ id: string; hasImage: boolean }> {
  try {
    let imgBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    if (style && style !== "auto") {
      imgBuffer = pickTemplateByStyle(style, text);
    } else {
      const useTemplate = Math.random() < 0.7;
      if (useTemplate) imgBuffer = pickTemplate(text);
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
  } catch (err) {
    // Don't retry on a Twitter-level block — it will fail again without the image too
    const msg = String(err);
    if (msg.includes("code 226") || msg.includes("Twitter API error")) throw err;
    // Fallback: post without image (image upload/fetch failure only)
    const client = await getXClient();
    const res = await client.sendTweet(text);
    const id = await extractTweetId(res);
    return { id, hasImage: false };
  }
}

function smartTruncate(text: string, limit = 275): string {
  if (text.length <= limit) return text;
  // Find last sentence boundary (. ! ?) before the limit
  const cut = text.slice(0, limit);
  const lastBoundary = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf(".\n"), cut.lastIndexOf("!\n"), cut.lastIndexOf("?\n"));
  if (lastBoundary > limit * 0.5) return text.slice(0, lastBoundary + 1).trim();
  // No clean boundary — at least cut at a word boundary
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? text.slice(0, lastSpace) : cut).trim();
}

export async function replyToTweet(tweetId: string, text: string, opts?: { wClient?: Scraper }): Promise<{ id: string }> {
  const safe = smartTruncate(text, 275);
  const client = opts?.wClient ?? await getXClient();
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
  imageMode: "none" | "first" | "all" = "none",
  imageStyle?: string,
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
      imgBuffer = imageStyle && imageStyle !== "auto"
        ? pickTemplateByStyle(imageStyle, text)
        : pickTemplate(text);
      if (!imgBuffer) {
        try {
          const ogUrl = `${process.env.NEXTAUTH_URL}/api/og?text=${encodeURIComponent(text.slice(0, 220))}`;
          const imgRes = await fetch(ogUrl, { signal: AbortSignal.timeout(8000) });
          if (imgRes.ok) { imgBuffer = Buffer.from(await imgRes.arrayBuffer()); mimeType = "image/png"; }
        } catch { /* skip image */ }
      }
    }

    const mediaData = imgBuffer ? [{ data: imgBuffer, mediaType: mimeType }] : undefined;
    // Wait between thread tweets so X doesn't flag the burst as automated
    if (i > 0) await randomDelay(12000, 22000);
    const res = await client.sendTweet(text, lastId, mediaData);
    const id = await extractTweetId(res);
    posted.push({ id, hasImage: !!imgBuffer });
    lastId = id;
  }

  return posted;
}
