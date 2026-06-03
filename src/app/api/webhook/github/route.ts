import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
  const rawBody = await req.text();

  // Validate X-Hub-Signature-256
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") ?? "";
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repo: string =
    (body.repository as Record<string, unknown>)?.full_name as string ?? "unknown/repo";

  if (event === "push") {
    const ref = (body.ref as string) ?? "";
    const branch = ref.replace("refs/heads/", "");
    if (branch !== "main" && branch !== "master") {
      return NextResponse.json({ ok: true });
    }
    const commits = (body.commits as Array<{ message: string }>) ?? [];
    const lines = commits
      .slice(0, 3)
      .map((c) => `• ${c.message.split("\n")[0].slice(0, 80)}`);
    await tg(
      `🔨 *[${repo}]* pushed ${commits.length} commit${commits.length !== 1 ? "s" : ""} to \`${branch}\`\n${lines.join("\n")}`
    );
  } else if (event === "watch" && body.action === "started") {
    const user: string =
      (body.sender as Record<string, unknown>)?.login as string ?? "someone";
    await tg(`⭐ @${user} starred *${repo}*!`);
  } else if (event === "fork") {
    const user: string =
      (body.sender as Record<string, unknown>)?.login as string ?? "someone";
    await tg(`🍴 @${user} forked *${repo}*!`);
  } else if (event === "pull_request") {
    const action = body.action as string;
    const pr = body.pull_request as Record<string, unknown>;
    const title = pr?.title as string ?? "";
    const url = pr?.html_url as string ?? "";
    const merged = pr?.merged as boolean;

    let emoji: string;
    let label: string;
    if (action === "opened") {
      emoji = "🔀";
      label = "PR opened";
    } else if (action === "closed" && merged) {
      emoji = "✅";
      label = "PR merged";
    } else if (action === "closed" && !merged) {
      emoji = "❌";
      label = "PR closed";
    } else {
      return NextResponse.json({ ok: true });
    }
    await tg(`${emoji} *${label}:* ${title}\n[View PR](${url})`);
  } else if (event === "issues") {
    const action = body.action as string;
    if (action !== "opened" && action !== "closed") {
      return NextResponse.json({ ok: true });
    }
    const issue = body.issue as Record<string, unknown>;
    const title = issue?.title as string ?? "";
    const url = issue?.html_url as string ?? "";
    const emoji = action === "opened" ? "🐛" : "✅";
    await tg(`${emoji} *Issue ${action}:* ${title}\n[View issue](${url})`);
  } else if (event === "release" && body.action === "published") {
    const release = body.release as Record<string, unknown>;
    const tag = release?.tag_name as string ?? "";
    const name = release?.name as string ?? tag;
    const url = release?.html_url as string ?? "";
    await tg(`🚀 *Released ${tag}:* ${name}\n[View release](${url})`);
  } else if (event === "create" && body.ref_type === "tag") {
    const tag = body.ref as string ?? "";
    await tg(`🏷️ *New tag:* \`${tag}\` in *${repo}*`);
  }

  return NextResponse.json({ ok: true });
}
