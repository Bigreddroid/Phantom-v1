import { xRW } from "./client";
import { EUploadMimeType } from "twitter-api-v2";

export async function postTweet(text: string) {
  const tweet = await xRW.v2.tweet(text);
  return tweet.data;
}

export async function postTweetWithImage(text: string): Promise<{ id: string; hasImage: boolean }> {
  try {
    const ogUrl = `${process.env.NEXTAUTH_URL}/api/og?text=${encodeURIComponent(text.slice(0, 220))}`;
    const imgRes = await fetch(ogUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) throw new Error("og fetch failed");

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const mediaId = await xRW.v1.uploadMedia(imgBuffer, { mimeType: EUploadMimeType.Png });
    const tweet = await xRW.v2.tweet({ text, media: { media_ids: [mediaId] } });
    return { ...tweet.data, hasImage: true };
  } catch {
    // Graceful fallback: post text-only if media upload unavailable
    const tweet = await xRW.v2.tweet(text);
    return { ...tweet.data, hasImage: false };
  }
}

export async function replyToTweet(tweetId: string, text: string) {
  // Twitter hard limit is 280 chars — truncate defensively
  const safe = text.length > 275 ? text.slice(0, 272) + "…" : text;
  const reply = await xRW.v2.reply(safe, tweetId);
  return reply.data;
}

export async function quoteTweet(tweetId: string, text: string) {
  const quote = await xRW.v2.tweet({ text, quote_tweet_id: tweetId });
  return quote.data;
}

export async function deleteTweet(tweetId: string) {
  return xRW.v2.deleteTweet(tweetId);
}

async function uploadOgImage(text: string): Promise<string | null> {
  try {
    const ogUrl = `${process.env.NEXTAUTH_URL}/api/og?text=${encodeURIComponent(text.slice(0, 220))}`;
    const imgRes = await fetch(ogUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) throw new Error("og fetch failed");
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    return await xRW.v1.uploadMedia(imgBuffer, { mimeType: EUploadMimeType.Png });
  } catch {
    return null;
  }
}

// imageMode: "none" | "first" (image on tweet 1 only) | "all" (image on every tweet)
export async function postThread(
  tweets: string[],
  imageMode: "none" | "first" | "all" = "none"
) {
  const posted: Array<{ id: string; hasImage?: boolean }> = [];
  let lastId: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i];
    const wantsImage = imageMode === "all" || (imageMode === "first" && i === 0);
    let mediaId: string | null = null;

    if (wantsImage) mediaId = await uploadOgImage(text);

    const mediaIds = mediaId ? [mediaId] as [string] : undefined;

    const tweet = lastId
      ? await xRW.v2.reply(text, lastId, mediaIds ? { media: { media_ids: mediaIds } } : undefined)
      : mediaIds
        ? await xRW.v2.tweet({ text, media: { media_ids: mediaIds } })
        : await xRW.v2.tweet(text);

    posted.push({ ...tweet.data, hasImage: !!mediaId });
    lastId = tweet.data.id;
  }

  return posted;
}
