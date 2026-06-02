import { config } from "dotenv";
config({ path: ".env.local" });

import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

console.log("\n📊 Checking @BigRedDr0id...\n");

// Profile + stats
const me = await client.v2.me({
  "user.fields": ["public_metrics", "description", "created_at", "location"],
});

const m = me.data.public_metrics;
console.log("👤 Name:", me.data.name);
console.log("📝 Bio:", me.data.description);
console.log("📍 Location:", me.data.location ?? "not set");
console.log("📅 Joined:", me.data.created_at);
console.log("");
console.log("📈 Stats:");
console.log("   Followers:  ", m.followers_count);
console.log("   Following:  ", m.following_count);
console.log("   Tweets:     ", m.tweet_count);
console.log("   Listed:     ", m.listed_count);

// Recent tweets
const tweets = await client.v2.userTimeline(me.data.id, {
  max_results: 5,
  "tweet.fields": ["public_metrics", "created_at"],
  exclude: ["retweets", "replies"],
});

console.log("\n🐦 Recent tweets:");
for (const tweet of tweets.data?.data ?? []) {
  const tm = tweet.public_metrics;
  console.log(`\n   "${tweet.text.slice(0, 80)}..."`);
  console.log(`   ❤️  ${tm.like_count}  🔁 ${tm.retweet_count}  💬 ${tm.reply_count}  👁️  ${tm.impression_count}`);
}
