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
  const reply = await xRW.v2.reply(text, tweetId);
  return reply.data;
}

export async function quoteTweet(tweetId: string, text: string) {
  const quote = await xRW.v2.tweet({ text, quote_tweet_id: tweetId });
  return quote.data;
}

export async function deleteTweet(tweetId: string) {
  return xRW.v2.deleteTweet(tweetId);
}

export async function postThread(tweets: string[]) {
  const posted = [];
  let lastId: string | undefined;

  for (const text of tweets) {
    const tweet = lastId
      ? await xRW.v2.reply(text, lastId)
      : await xRW.v2.tweet(text);
    posted.push(tweet.data);
    lastId = tweet.data.id;
  }

  return posted;
}
