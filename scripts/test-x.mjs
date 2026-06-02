import { config } from "dotenv";
config({ path: ".env.local" });

import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const rwClient = client.readWrite;

async function runTests() {
  console.log("\n🔍 Testing X API connection...\n");

  // Test 1 — verify credentials
  try {
    const me = await client.v2.me();
    console.log("✅ Auth OK — connected as @" + me.data.username);
    console.log("   Name:", me.data.name);
    console.log("   ID:", me.data.id);
  } catch (e) {
    console.error("❌ Auth failed:", e.message);
    process.exit(1);
  }

  // Test 2 — read timeline
  try {
    const timeline = await client.v2.homeTimeline({ max_results: 5 });
    console.log("\n✅ Timeline read OK —", timeline.data?.data?.length ?? 0, "tweets fetched");
  } catch (e) {
    console.log("\n⚠️  Timeline read failed (may need elevated access):", e.message);
  }

  // Test 3 — read mentions
  try {
    const me = await client.v2.me();
    const mentions = await client.v2.userMentionTimeline(me.data.id, { max_results: 5 });
    console.log("✅ Mentions read OK —", mentions.data?.data?.length ?? 0, "mentions");
  } catch (e) {
    console.log("⚠️  Mentions read failed:", e.message);
  }

  // Test 4 — post a tweet
  try {
    const tweet = await rwClient.v2.tweet("🤖 Phantom automation test — ignore this tweet. [" + Date.now() + "]");
    console.log("\n✅ Tweet posted OK — ID:", tweet.data.id);

    // delete it right after
    await rwClient.v2.deleteTweet(tweet.data.id);
    console.log("✅ Tweet deleted OK");
  } catch (e) {
    console.error("\n❌ Tweet failed:", e.message);
    console.error("   Code:", e.code);
    console.error("   Data:", JSON.stringify(e.data, null, 2));
  }

  console.log("\n✅ All tests complete.\n");
}

runTests();
