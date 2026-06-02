import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// xAI Grok — OpenAI-compatible, trained on X/Twitter data
const grok = process.env.GROK_API_KEY
  ? new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: process.env.GROK_API_KEY })
  : null;

import { X_HANDLE, VOICE_TOPICS } from "@/lib/config";

const VOICE_SYSTEM_PROMPT = `You are a ghostwriter for a founder/creator (${X_HANDLE}).
Write in their voice: direct, confident, no fluff, no emojis unless natural,
conversational but intelligent. Never sound like a bot or a marketing email.
Vary sentence length. Sound like a real person thinking out loud.
Topics: ${VOICE_TOPICS}.`;

// Use Grok when available (better for X/Twitter content), fall back to Claude
async function generate(prompt: string, system: string, maxTokens: number): Promise<string> {
  if (grok) {
    const res = await grok.chat.completions.create({
      model: "grok-3",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return (msg.content[0] as { text: string }).text.trim();
}

export async function generateTweet(topic: string, context?: string) {
  return generate(
    `Write a single tweet about: ${topic}${context ? `\n\nContext: ${context}` : ""}

Rules:
- Under 280 characters
- No hashtags unless they add real value
- No generic opener like "Hot take:" or "Thread:"
- Sound like a real thought, not a post`,
    VOICE_SYSTEM_PROMPT,
    300
  );
}

export async function generateThread(topic: string, numTweets = 5) {
  const raw = await generate(
    `Write a ${numTweets}-tweet thread about: ${topic}

Format each tweet on its own line, separated by "---"
First tweet hooks the reader. Last tweet has a clear CTA.
Each tweet under 280 characters. No numbering like "1/" needed.`,
    VOICE_SYSTEM_PROMPT,
    1500
  );
  return raw.split("---").map((t) => t.trim()).filter(Boolean);
}

export async function generateReply(mentionText: string, authorUsername: string) {
  return generate(
    `@${authorUsername} tweeted: "${mentionText}"

Write a reply. Be genuine, add value or continue the conversation.
Under 280 characters. Don't start with their name.`,
    VOICE_SYSTEM_PROMPT,
    200
  );
}

export async function generateGoOutComment(tweetText: string) {
  return generate(
    `Someone tweeted: "${tweetText}"

Write a short reply. Max 180 characters.
Can be a quick take, a mild disagreement, a punchy question, or a dry observation.
Don't start with "I" or their handle. No flattery. No "great point". No corporate-speak.
If you disagree slightly, say so. If it's obvious, point that out.
One or two sentences max.`,
    `You're someone who's been building online for years and has opinions.
Confident, occasionally dry, a little cocky — but not mean.
You reply like you actually have something to say, not like you're trying to network.
Never sycophantic. Sounds real, not polished.`,
    180
  );
}

export async function generateDM(recipientUsername: string, context: string) {
  return generate(
    `Write a cold DM to @${recipientUsername}.
Context: ${context}

Rules:
- Warm, not salesy
- Specific to them (reference their work/content)
- Clear ask or reason for reaching out
- Under 300 characters
- No "I hope this message finds you well"`,
    VOICE_SYSTEM_PROMPT,
    300
  );
}
