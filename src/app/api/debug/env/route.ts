import { NextRequest, NextResponse } from "next/server";

// Temporary diagnostic endpoint — shows which env vars are set and validates the bot token.
// Protected by CRON_SECRET. Remove after confirming bot works.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = process.env.TELEGRAM_CHAT_ID ?? "";

  // Test the token against Telegram
  let botInfo: unknown = null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    botInfo = await res.json();
  } catch {
    botInfo = { error: "fetch failed" };
  }

  return NextResponse.json({
    TELEGRAM_BOT_TOKEN_prefix: token.split(":")[0],
    TELEGRAM_BOT_TOKEN_length: token.length,
    TELEGRAM_CHAT_ID: chatId,
    TELEGRAM_WEBHOOK_SECRET_set: !!process.env.TELEGRAM_WEBHOOK_SECRET,
    botInfo,
  });
}
