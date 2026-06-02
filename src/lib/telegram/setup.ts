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

// Keeps the bot's / command menu in sync with the actual command list.
export async function ensureCommands(): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const result = await api("/setMyCommands", {
      commands: [
        { command: "status",    description: "Live stats — followers, tweets, engagement" },
        { command: "activity",  description: "Last 10 actions Phantom took" },
        { command: "tweet",     description: "Generate & post a tweet now" },
        { command: "thread",    description: "Generate & post a 5-tweet thread" },
        { command: "post",      description: "Post your own tweet instantly" },
        { command: "engage",    description: "Run engagement — like & reply" },
        { command: "goout",     description: "Drop comments on 5 tweets (human mode)" },
        { command: "follow",    description: "Follow + like + reply to n accounts" },
        { command: "mentions",  description: "Auto-reply to all current mentions" },
        { command: "schedule",  description: "Show the full automation schedule" },
        { command: "pause",     description: "Pause automation" },
        { command: "resume",    description: "Resume automation" },
        { command: "dm",        description: "Send a personalised cold DM to a user" },
        { command: "blacklist", description: "Silently ignore an account" },
        { command: "setup",     description: "Register webhook and command menu" },
        { command: "test",      description: "Test X API connectivity (auth, search, DMs)" },
        { command: "help",      description: "Show all commands" },
      ],
    });
    return result.ok === true;
  } catch {
    return false;
  }
}
