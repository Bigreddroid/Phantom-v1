import { xRW, xRO } from "./client";

export async function likeTweet(tweetId: string, userId: string) {
  return xRW.v2.like(userId, tweetId);
}

export async function unlikeTweet(tweetId: string, userId: string) {
  return xRW.v2.unlike(userId, tweetId);
}

export async function retweet(tweetId: string, userId: string) {
  return xRW.v2.retweet(userId, tweetId);
}

export async function followUser(targetUserId: string, sourceUserId: string) {
  return xRW.v2.follow(sourceUserId, targetUserId);
}

export async function unfollowUser(targetUserId: string, sourceUserId: string) {
  return xRW.v2.unfollow(sourceUserId, targetUserId);
}

export async function getMentions(userId: string, sinceId?: string) {
  const params: Record<string, unknown> = {
    max_results: 20,
    "tweet.fields": ["author_id", "created_at", "text", "conversation_id"],
    "user.fields": ["username", "name", "public_metrics"],
    expansions: ["author_id"],
  };
  if (sinceId) params.since_id = sinceId;

  const mentions = await xRO.v2.userMentionTimeline(userId, params);
  return mentions.data?.data ?? [];
}

export async function searchTweets(query: string, maxResults = 10) {
  const results = await xRO.v2.search(query, {
    max_results: maxResults,
    "tweet.fields": ["author_id", "created_at", "public_metrics"],
    "user.fields": ["username", "name"],
    expansions: ["author_id"],
  });
  return results.data?.data ?? [];
}

export async function getMyProfile() {
  const me = await xRO.v2.me({
    "user.fields": ["public_metrics", "description"],
  });
  return me.data;
}
