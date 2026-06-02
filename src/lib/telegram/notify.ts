const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

export async function sendMessage(text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
  });
}

export async function requestApproval(
  action: string,
  content: string,
  metadata: Record<string, string> = {}
): Promise<string> {
  const approvalId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const text = `*🤖 Phantom — Approval Required*\n\n*Action:* ${action}\n\n*Content:*\n\`\`\`\n${content}\n\`\`\`${
    Object.keys(metadata).length
      ? "\n\n*Context:* " + Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join(" | ")
      : ""
  }\n\n*ID:* \`${approvalId}\``;

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve:${approvalId}` },
            { text: "✏️ Edit", callback_data: `edit:${approvalId}` },
            { text: "❌ Reject", callback_data: `reject:${approvalId}` },
          ],
        ],
      },
    }),
  });

  return approvalId;
}

export async function notifyPosted(action: string, content: string) {
  await sendMessage(`*✅ Phantom posted*\n\n*${action}*\n\n${content}`);
}

export async function notifyError(action: string, error: string) {
  await sendMessage(`*❌ Phantom error*\n\n*${action}*\n\n\`${error}\``);
}
