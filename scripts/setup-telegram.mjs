/**
 * Registers the Telegram webhook and sends a test message.
 * Run once after deploy: node scripts/setup-telegram.mjs
 *
 * Required env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, NEXTAUTH_URL
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import https from "https";

config({ path: resolve(fileURLToPath(import.meta.url), "../../.env.local") });

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const appUrl = process.env.NEXTAUTH_URL;

if (!token || !chatId || !appUrl) {
  console.error("Missing: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, or NEXTAUTH_URL in .env.local");
  process.exit(1);
}

const webhookUrl = `${appUrl}/api/telegram`;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname: "api.telegram.org", path: `/bot${token}${path}`, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.telegram.org/bot${token}${path}`, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", reject);
  });
}

async function main() {
  console.log("Setting up Telegram bot for Phantom...\n");

  // 1. Check current webhook
  const info = await get("/getWebhookInfo");
  console.log("Current webhook:", info.result?.url || "(none)");

  // 2. Register webhook
  const setResult = await post("/setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
  });
  console.log("Set webhook →", webhookUrl);
  console.log("Result:", setResult.ok ? "✅ Success" : "❌ Failed — " + setResult.description);

  // 3. Verify
  const verify = await get("/getWebhookInfo");
  console.log("\nVerified webhook:", verify.result?.url);
  console.log("Pending updates:", verify.result?.pending_update_count ?? 0);

  // 4. Send test message
  const msg = await post("/sendMessage", {
    chat_id: chatId,
    text: "🤖 *Phantom is connected.* Send /help to see all commands.",
    parse_mode: "Markdown",
  });
  console.log("\nTest message:", msg.ok ? "✅ Delivered to chat" : "❌ Failed — " + msg.description);

  if (!msg.ok) {
    console.log("\n⚠️  Check that TELEGRAM_CHAT_ID is correct.");
    console.log("   Start the bot first by sending /start in Telegram.");
  }
}

main().catch(console.error);
