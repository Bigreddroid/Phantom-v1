import { config } from "dotenv";
config({ path: ".env.local" });

import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

console.log("\n⚙️  Setting up @BigRedDr0id profile...\n");

try {
  await client.v1.updateAccountProfile({
    name: "BigRedDroid",
    description: "Building Phantom — AI that runs your personal brand on autopilot\n92 automations. One platform. | Building in public 🔨",
    location: "India",
  });
  console.log("✅ Bio updated");
} catch (e) {
  console.error("❌ Profile update failed:", e.message);
}

// Post pinned tweet
try {
  const tweet = await client.v2.tweet(
    `I'm building an AI system that runs your personal brand 24/7.\n\nPosts. Replies. DMs. Engagement. Lead gen — all on autopilot.\n\nCalled it Phantom. Building it in public from 0.\n\nFollow the journey.`
  );
  console.log("✅ Pinned tweet posted — ID:", tweet.data.id);
  console.log("\n   👉 Now go to X and pin this tweet manually:");
  console.log(`   https://x.com/BigRedDr0id/status/${tweet.data.id}`);
} catch (e) {
  console.error("❌ Tweet failed:", e.message);
}
