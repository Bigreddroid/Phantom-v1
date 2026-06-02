import { xRW } from "./client";

export async function postTweet(text: string) {
  const tweet = await xRW.v2.tweet(text);
  return tweet.data;
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
