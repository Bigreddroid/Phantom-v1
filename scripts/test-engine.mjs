import { config } from "dotenv";
config({ path: ".env.local" });

console.log("\n🚀 Testing Phantom Automation Engine...\n");

// Test 1 — Claude content generation
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

try {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: "Write a tweet about building a personal brand as a founder. Under 280 chars, no hashtags, sound real." }],
  });
  console.log("✅ Claude content generation working");
  console.log("   Sample tweet:", msg.content[0].text.trim());
} catch (e) {
  console.error("❌ Claude failed:", e.message);
}

// Test 2 — Telegram approval message
try {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "*🤖 Phantom Engine Test*\n\nApproval system working. This is what a real approval looks like:\n\n*Action:* Post Tweet\n*Content:*\n```\nBuilding in public is the best marketing strategy no one talks about. You document, they follow. You ship, they trust. You fail, they root for you.\n```",
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: "approve:test" },
          { text: "✏️ Edit", callback_data: "edit:test" },
          { text: "❌ Reject", callback_data: "reject:test" },
        ]],
      },
    }),
  });
  const data = await res.json();
  if (data.ok) console.log("✅ Telegram approval system working");
  else console.error("❌ Telegram failed:", data);
} catch (e) {
  console.error("❌ Telegram failed:", e.message);
}

console.log("\n✅ Engine test complete.\n");
