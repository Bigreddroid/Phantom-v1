import { getXClient, getConvoScraper, ConvoSearchMode } from "./client";
import type { Scraper } from "agent-twitter-client";
import type { Scraper as ConvoScraper } from "@the-convocation/twitter-scraper";

interface WOpts { wClient?: Scraper }
interface ROpts { rClient?: ConvoScraper; username?: string }

export async function likeTweet(tweetId: string, _userId?: string, opts?: WOpts) {
  const scraper = opts?.wClient ?? await getXClient();
  return scraper.likeTweet(tweetId);
}

export async function unlikeTweet(_tweetId: string, _userId?: string) {
  // Not available in agent-twitter-client — no-op
}

export async function retweet(tweetId: string, _userId?: string, opts?: WOpts) {
  const scraper = opts?.wClient ?? await getXClient();
  return scraper.retweet(tweetId);
}

export async function followUser(targetUsername: string, _sourceUserId?: string, opts?: WOpts) {
  const scraper = opts?.wClient ?? await getXClient();
  return scraper.followUser(targetUsername);
}

export async function getMentions(_userId?: string, sinceId?: string, opts?: ROpts) {
  const s = opts?.rClient ?? await getConvoScraper();
  const username = opts?.username ?? process.env.X_USERNAME!;
  const tweets: Awaited<ReturnType<typeof searchTweets>> = [];
  for await (const t of s.searchTweets(
    `@${username} -from:${username} -is:retweet`,
    20,
    ConvoSearchMode.Latest
  )) {
    if (sinceId && t.id) {
      try { if (BigInt(t.id) <= BigInt(sinceId)) break; } catch { /* malformed ID, skip check */ }
    }
    tweets.push({
      id: t.id ?? "",
      text: t.text ?? "",
      author_id: t.userId ?? "",
      author_username: t.username ?? "",
      conversation_id: (t as unknown as Record<string, unknown>).conversationId as string ?? t.id ?? "",
      public_metrics: { like_count: t.likes ?? 0, retweet_count: t.retweets ?? 0, reply_count: t.replies ?? 0, quote_count: 0 },
      reply_settings: "everyone",
    });
  }
  return tweets;
}

export async function searchTweets(query: string, maxResults = 10) {
  const s = await getConvoScraper();
  const tweets: Array<{
    id: string; text: string; author_id: string; author_username: string;
    conversation_id: string;
    public_metrics: { like_count: number; retweet_count: number; reply_count: number; quote_count: number };
    reply_settings: string;
  }> = [];
  for await (const t of s.searchTweets(query, maxResults, ConvoSearchMode.Latest)) {
    tweets.push({
      id: t.id ?? "",
      text: t.text ?? "",
      author_id: t.userId ?? "",
      author_username: t.username ?? "",
      conversation_id: (t as unknown as Record<string, unknown>).conversationId as string ?? t.id ?? "",
      public_metrics: { like_count: t.likes ?? 0, retweet_count: t.retweets ?? 0, reply_count: t.replies ?? 0, quote_count: 0 },
      reply_settings: "everyone",
    });
  }
  return tweets;
}

export async function getMyProfile(opts?: ROpts) {
  const username = opts?.username ?? process.env.X_USERNAME!;
  const s = opts?.rClient ?? await getConvoScraper();
  const profile = await s.getProfile(username);
  if (!profile) throw new Error("Failed to fetch own X profile");
  return {
    id: profile.userId ?? "",
    username: profile.username ?? username,
    public_metrics: {
      followers_count: profile.followersCount ?? 0,
      following_count: profile.followingCount ?? 0,
      tweet_count: profile.tweetsCount ?? 0,
    },
  };
}

export async function getMyTweets(_userId: string, maxResults = 20, opts?: WOpts & ROpts) {
  const scraper = opts?.wClient ?? await getXClient();
  const username = opts?.username ?? process.env.X_USERNAME!;
  const tweets: Array<{
    id: string;
    text: string;
    created_at: string;
    public_metrics: { like_count: number; retweet_count: number; reply_count: number; quote_count: number };
  }> = [];

  for await (const tweet of scraper.getTweets(username, maxResults)) {
    if (tweet.isRetweet || tweet.isReply) continue;
    tweets.push({
      id: tweet.id ?? "",
      text: tweet.text ?? "",
      created_at: tweet.timeParsed?.toISOString()
        ?? (tweet.timestamp ? new Date(tweet.timestamp * 1000).toISOString() : new Date().toISOString()),
      public_metrics: {
        like_count: tweet.likes ?? 0,
        retweet_count: tweet.retweets ?? 0,
        reply_count: tweet.replies ?? 0,
        quote_count: 0,
      },
    });
    if (tweets.length >= maxResults) break;
  }

  return tweets;
}

export async function getUserByUsername(username: string) {
  const s = await getConvoScraper();
  const profile = await s.getProfile(username);
  return { id: profile.userId ?? "", username: profile.username ?? username };
}
