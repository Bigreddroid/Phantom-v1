import { NextRequest, NextResponse } from "next/server";

const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT = process.env.TELEGRAM_CHAT_ID!;

async function tg(text: string) {
  await fetch(`${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
}

export async function POST(req: NextRequest) {
  // Validate secret — Vercel passes it as a query param or Authorization header
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const headerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type as string ?? "";
  const payload = (body.payload as Record<string, unknown>) ?? body;

  const project: string =
    (payload.name as string) ??
    ((payload.project as Record<string, unknown>)?.name as string) ??
    "unknown";
  const target: string =
    (payload.target as string) ??
    (payload.meta as Record<string, unknown>)?.["github-deployment-sha"] as string ??
    "preview";
  const url: string =
    (payload.url as string)
      ? `https://${payload.url as string}`
      : "";
  const inspectUrl: string = (payload.inspectorUrl as string) ?? (payload.inspect_url as string) ?? "";

  if (type === "deployment.created") {
    await tg(`🏗️ *Deploying ${project}* to \`${target}\`...`);
  } else if (type === "deployment.succeeded") {
    const msg = `✅ *${project}* deployed to \`${target}\`` + (url ? `\n[Open](${url})` : "");
    await tg(msg);
  } else if (type === "deployment.error") {
    const msg =
      `❌ *Deploy failed* for \`${project}\`` +
      (inspectUrl ? `\n[Inspect](${inspectUrl})` : "");
    await tg(msg);
  } else if (type === "deployment.canceled") {
    await tg(`⚠️ *Deploy canceled* for \`${project}\``);
  }

  return NextResponse.json({ ok: true });
}
