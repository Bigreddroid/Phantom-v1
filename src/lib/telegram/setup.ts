const BOT = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function api(path: string, body?: object) {
  const res = await fetch(`${BOT}${path}`, body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : undefined);
  return res.json();
}

// Idempotent — safe to call on every cron run.
// Registers the webhook only if it's missing or pointing at the wrong URL.
export async function ensureWebhook(): Promise<boolean> {
  const appUrl = process.env.NEXTAUTH_URL;
  if (!appUrl || !process.env.TELEGRAM_BOT_TOKEN) return false;

  const target = `${appUrl}/api/telegram`;

  try {
    const info = await api("/getWebhookInfo");
    if (info.result?.url === target) return true; // already correct

    const result = await api("/setWebhook", {
      url: target,
      allowed_updates: ["message", "callback_query"],
    });
    return result.ok === true;
  } catch {
    return false;
  }
}
