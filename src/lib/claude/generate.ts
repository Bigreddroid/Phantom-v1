import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VOICE_SYSTEM_PROMPT = `You are a ghostwriter for a founder/creator.
Write in their voice: direct, confident, no fluff, no emojis unless natural,
conversational but intelligent. Never sound like a bot or a marketing email.
Vary sentence length. Sound like a real person thinking out loud.`;

export async function generateTweet(topic: string, context?: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: VOICE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Write a single tweet about: ${topic}${context ? `\n\nContext: ${context}` : ""}

Rules:
- Under 280 characters
- No hashtags unless they add real value
- No generic opener like "Hot take:" or "Thread:"
- Sound like a real thought, not a post`,
      },
    ],
  });

  return (message.content[0] as { text: string }).text.trim();
}

export async function generateThread(topic: string, numTweets = 5) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: VOICE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Write a ${numTweets}-tweet thread about: ${topic}

Format each tweet on its own line, separated by "---"
First tweet hooks the reader. Last tweet has a clear CTA.
Each tweet under 280 characters. No numbering like "1/" needed.`,
      },
    ],
  });

  const raw = (message.content[0] as { text: string }).text.trim();
  return raw.split("---").map((t) => t.trim()).filter(Boolean);
}

export async function generateReply(mentionText: string, authorUsername: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: VOICE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `@${authorUsername} tweeted: "${mentionText}"

Write a reply. Be genuine, add value or continue the conversation.
Under 280 characters. Don't start with their name.`,
      },
    ],
  });

  return (message.content[0] as { text: string }).text.trim();
}

export async function generateDM(recipientUsername: string, context: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: VOICE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Write a cold DM to @${recipientUsername}.
Context: ${context}

Rules:
- Warm, not salesy
- Specific to them (reference their work/content)
- Clear ask or reason for reaching out
- Under 300 characters
- No "I hope this message finds you well"`,
      },
    ],
  });

  return (message.content[0] as { text: string }).text.trim();
}
