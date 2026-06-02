import { NextResponse } from "next/server";

const KEYS = [
  "X_API_KEY", "X_API_SECRET", "X_BEARER_TOKEN",
  "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET",
  "X_CLIENT_ID", "X_CLIENT_SECRET", "X_USER_ID",
  "ANTHROPIC_API_KEY", "GROK_API_KEY",
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
  "DATABASE_URL",
  "NEXTAUTH_SECRET", "NEXTAUTH_URL", "CRON_SECRET",
  "X_HANDLE", "NEXT_PUBLIC_X_HANDLE", "DISPLAY_INITIAL",
  "NICHE_KEYWORDS", "CONTENT_TOPICS", "THREAD_TOPICS", "VOICE_TOPICS",
  "BLOCKED_USERNAMES", "BLOCKED_IDS",
  "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET",
];

export async function GET() {
  const status: Record<string, boolean> = {};
  for (const key of KEYS) {
    status[key] = Boolean(process.env[key]?.trim());
  }
  return NextResponse.json(status);
}
