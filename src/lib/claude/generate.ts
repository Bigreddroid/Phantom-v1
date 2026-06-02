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

export async function generateLinkedInPost(topic: string) {
  return generate(
    `Write a LinkedIn post about: ${topic}

Format:
- First line is a standalone hook — short, punchy, makes someone stop scrolling
- Leave a blank line after the hook
- 3–5 short paragraphs or bullet lines (use line breaks, not walls of text)
- End with a genuine insight or a real question — not a call-to-action
- 500–1100 characters total
- 2–3 relevant hashtags at the very end on their own line
- No corporate buzzwords (leverage, synergy, circle back, excited to announce)
- No "I'm humbled" or "Here's what I learned" openers`,
    `You are a ghostwriter for a founder/creator (${X_HANDLE}).
Write in their voice: direct, confident, no fluff, conversational but intelligent.
LinkedIn tone: slightly more professional than Twitter, but still human and opinionated.
The audience is other founders, operators, and professionals who are allergic to performative LinkedIn content.
Sound like someone sharing a real lesson from building, not a motivational quote account.`,
    700
  );
}

export async function generateLinkedInStory(recentTweets: string[]) {
  const context = recentTweets.length
    ? `\n\nRecent X posts to draw from (use as inspiration, not direct copy):\n${recentTweets.map(t => `- ${t}`).join("\n")}`
    : "";
  return generate(
    `Write a LinkedIn story post — a short personal narrative about a real moment from building a product or running a business.${context}

Format:
- Open with a specific scene or moment ("I was sitting at my desk at 2am when..." style) — not generic advice
- Tell the story in 3–4 short paragraphs — what happened, what went wrong or right, what you realised
- End with the honest takeaway — one sentence, no moralising
- 600–1200 characters total
- 1–2 hashtags max at the end
- No "I'm proud to announce", no "humbled", no "excited to share"
- Reads like a journal entry, not a press release`,
    `You are a ghostwriter for a founder/creator (${X_HANDLE}).
Write in first-person, personal, vulnerable but not dramatic.
LinkedIn audience: other builders who respect honesty over polish.
The goal is to feel real — not inspirational content.`,
    800
  );
}

export async function generateLinkedInList(topic: string) {
  return generate(
    `Write a LinkedIn list post about: ${topic}

Format:
- Hook line first (standalone, no fluff)
- Blank line, then exactly 5 numbered points
- Each point: bold title + 1–2 sentence explanation on the same line
- Total 700–1300 characters
- Close with one honest observation (not a CTA)
- 2–3 hashtags at the end
- No "game-changing", "revolutionary", or "this will blow your mind"
- Make each point specific and actionable, not vague`,
    `You are a ghostwriter for a founder/creator (${X_HANDLE}).
Direct, intelligent, no buzzwords. LinkedIn list posts that feel like real advice,
not growth-hacker tips. Each point should make someone think, not just nod.`,
    900
  );
}

export async function generateQuoteTweet(originalText: string) {
  return generate(
    `You're quote-tweeting your own old post to resurface it with fresh context:\n\n"${originalText}"\n\nWrite a 1–2 sentence quote-tweet comment that adds new insight, a update, or a punchy observation. Don't just repeat the original. Under 200 characters. No "back to this" or "still relevant" openers.`,
    VOICE_SYSTEM_PROMPT,
    200
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
