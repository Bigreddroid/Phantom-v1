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

    const webhookBody: Record<string, unknown> = {
      url: target,
      allowed_updates: ["message", "callback_query"],
    };
    if (process.env.TELEGRAM_WEBHOOK_SECRET) {
      webhookBody.secret_token = process.env.TELEGRAM_WEBHOOK_SECRET;
    }
    const result = await api("/setWebhook", webhookBody);
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
        { command: "today",     description: "What Phantom did since midnight" },
        { command: "activity",  description: "Last 10 actions Phantom took" },
        { command: "tweet",     description: "Preview & approve a tweet before posting" },
        { command: "thread",    description: "Preview & approve a 5-tweet thread" },
        { command: "article",   description: "Generate an educational article thread on AI or tools" },
        { command: "longpost",  description: "Premium+ long-form post (800–2000 chars)" },
        { command: "post",      description: "Post your own tweet instantly" },
        { command: "queue",     description: "Pending approvals with live Approve/Reject/Regenerate buttons" },
        { command: "resurface",  description: "Quote-tweet one of your old posts" },
        { command: "rt",        description: "Retweet or quote-tweet a niche post" },
        { command: "blast",     description: "Post same text to X + LinkedIn instantly" },
        { command: "engage",    description: "Run engagement — like & reply (random topic)" },
        { command: "topic",     description: "Engage on a specific keyword /topic AI founder" },
        { command: "goout",     description: "Drop comments on 5 tweets (human mode)" },
        { command: "follow",    description: "Follow + like + reply to n accounts" },
        { command: "inbox",     description: "See unread mentions — reply, custom reply, or skip each" },
        { command: "mentions",  description: "Auto-reply to all current mentions (no preview)" },
        { command: "linkedin",  description: "Post to LinkedIn or check connection status" },
        { command: "waitlist",  description: "Show all waitlist signups with dates" },
        { command: "schedule",  description: "Show the full automation schedule" },
        { command: "pause",     description: "Pause automation (queue preserved)" },
        { command: "kill",      description: "Hard stop — pause + wipe entire pending queue" },
        { command: "resume",    description: "Resume automation" },
        { command: "dm",        description: "Send a feedback-ask DM to a builder" },
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
