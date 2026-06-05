const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

async function send(text: string, markup?: object) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "Markdown",
      ...(markup ? { reply_markup: markup } : {}),
    }),
  });
}

export async function sendMessage(text: string) {
  await send(text);
}

// Approval request with inline buttons
export async function requestApproval(
  action: string,
  content: string,
  metadata: Record<string, string> = {}
): Promise<string> {
  const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const text = `*🤖 Phantom — Approval Required*\n\n*Action:* ${action}\n\n*Content:*\n\`\`\`\n${content.slice(0, 800)}\n\`\`\`${
    Object.keys(metadata).length
      ? "\n\n*Context:* " + Object.entries(metadata).filter(([k]) => k !== "id").map(([k, v]) => `${k}: ${v}`).join(" | ")
      : ""
  }\n\n_ID: \`${approvalId}\`_`;

  const id = metadata.id ?? approvalId;
  await send(text, {
    inline_keyboard: [
      [
        { text: "✅ Approve",      callback_data: `approve:${id}` },
        { text: "✏️ Edit",         callback_data: `edit:${id}` },
        { text: "❌ Reject",       callback_data: `reject:${id}` },
      ],
      [
        { text: "🔄 New version",  callback_data: `regenerate:${id}` },
        { text: "📤 X + LinkedIn", callback_data: `approve_xl:${id}` },
      ],
    ],
  });

  return approvalId;
}

// Posted successfully
export async function notifyPosted(type: string, content: string) {
  await send(`*✅ Posted to X*\n\n*${type}*\n\n${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`);
}

// New follower
export async function notifyNewFollower(username: string, followerCount: number) {
  await send(`*👤 New Follower*\n\n@${username} followed you\n\n*Total followers:* ${followerCount}`);
}

// Milestone reached
export async function notifyMilestone(milestone: number) {
  const handle = process.env.X_HANDLE ?? "@yourusername";
  await send(`*🎯 Milestone Reached!*\n\n*${milestone} followers* on ${handle}\n\nPhantom is working.`);
}

// New mention
export async function notifyMention(username: string, text: string) {
  await send(`*💬 New Mention*\n\n@${username} mentioned you:\n\n_"${text.slice(0, 200)}"_`);
}

// Daily summary
export async function notifyDailySummary(data: {
  followers: number;
  followerGain: number;
  tweetsPosted: number;
  engagements: number;
  mentions: number;
  dmsSent: number;
  brainFocus?: string;
  latestInsight?: string;
}) {
  const brainLine = data.brainFocus
    ? `\n*Current focus:* _${data.brainFocus.slice(0, 120)}_`
    : "";
  const insightLine = data.latestInsight
    ? `\n*Latest insight:* _${data.latestInsight.slice(0, 120)}_`
    : "";
  await send(
    `*📊 Phantom Daily Summary*\n\n` +
    `*Followers:* ${data.followers} _(+${data.followerGain} today)_\n` +
    `*Tweets posted:* ${data.tweetsPosted}\n` +
    `*Engagements:* ${data.engagements}\n` +
    `*Mentions:* ${data.mentions}\n` +
    `*DMs sent:* ${data.dmsSent}` +
    brainLine +
    insightLine +
    `\n\n_Phantom is running._`
  );
}

// Cron job fired
export async function notifyCronFired(job: string, result: string) {
  await send(`*⚙️ Cron: ${job}*\n\n${result}`);
}

// Error alert
export async function notifyError(action: string, error: string) {
  await send(`*❌ Phantom Error*\n\n*${action}*\n\n\`${error.slice(0, 300)}\``);
}

// Weekly summary
export async function notifyWeeklySummary(data: {
  followers: number;
  followerGain: number;
  tweetsPosted: number;
  totalEngagements: number;
}) {
  await send(
    `*📈 Phantom Weekly Summary*\n\n` +
    `*Total followers:* ${data.followers}\n` +
    `*New this week:* +${data.followerGain}\n` +
    `*Tweets posted:* ${data.tweetsPosted}\n` +
    `*Total engagements:* ${data.totalEngagements}\n\n` +
    `_Keep building._`
  );
}
