import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// xAI Grok — OpenAI-compatible, trained on X/Twitter data
const grok = process.env.GROK_API_KEY
  ? new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: process.env.GROK_API_KEY })
  : null;

import { X_HANDLE, VOICE_TOPICS } from "@/lib/config";

const VOICE_SYSTEM_PROMPT = `You are a ghostwriter for ${X_HANDLE} — a solo founder building BigRedDroid.
BigRedDroid is a solo deep-tech systems lab. The flagship project is Project Z: 92 AI automation products.
Product #1 (live now): Phantom — an AI system that automates your entire X/Twitter presence (posting, engaging, replying, following) 24/7, controlled via Telegram.
Write in their voice: direct, confident, no fluff, no emojis unless natural,
conversational but intelligent. Never sound like a bot or a marketing post.
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

export async function generateTweet(topic: string, context?: string, recentTweets?: string[]) {
  const avoidBlock = recentTweets?.length
    ? `\n\nSTRICTLY FORBIDDEN — these have already been posted. Do not repeat the topic, angle, phrasing, or structure of ANY of these:\n${recentTweets.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nIf you find yourself writing anything similar to the above, stop and pick a completely different angle.`
    : "";
  return generate(
    `Write a single tweet about: ${topic}${context ? `\n\nContext: ${context}` : ""}${avoidBlock}

Rules:
- Under 280 characters
- MUST name at least one of: Phantom, BigRedDroid, Project Z — not just the concept, the actual name
- No hashtags unless they add real value
- No generic opener like "Hot take:" or "Thread:"
- Sound like a real builder's thought, not a marketing post
- Every tweet must cover a different angle than what's been posted before`,
    VOICE_SYSTEM_PROMPT,
    300
  );
}

export async function generateThread(topic: string, numTweets = 5, recentTweets?: string[]) {
  const avoidBlock = recentTweets?.length
    ? `\n\nSTRICTLY FORBIDDEN — do not repeat the topic, angle, hook, or structure of any of these previous threads/tweets:\n${recentTweets.map((t, i) => `${i + 1}. ${t.slice(0, 120)}`).join("\n")}\n\nPick a completely fresh angle.`
    : "";
  const raw = await generate(
    `Write a ${numTweets}-tweet thread about: ${topic}${avoidBlock}

Format each tweet on its own line, separated by "---"
First tweet hooks the reader. Last tweet has a clear CTA.
Each tweet under 280 characters. No numbering like "1/" needed.`,
    VOICE_SYSTEM_PROMPT,
    1500
  );
  return raw.split("---").map((t) => t.trim()).filter(Boolean);
}

const REPLY_SYSTEM = `You are a warm, genuine person who loves building real connections online.
You're a solo founder (${X_HANDLE}) building in public — but when you reply to people, it's never about you.
It's about THEM. Your replies make people feel seen, heard, and glad they tweeted.
You're the person in someone's replies who actually gets it — not the one trying to be clever.
Tone: warm, real, human, occasionally dry humour — but NEVER cold, never dismissive, never lecturing.
You never start with "I". You never say "great point", "well said", "totally agree", "absolutely", or "definitely".
You never give unsolicited advice. You never correct people. You never push back unless asked.
Every reply is a COMPLETE thought — never trails off mid-sentence.`;

export async function generateReply(mentionText: string, authorUsername: string) {
  return generate(
    `@${authorUsername} tweeted: "${mentionText}"

Write a genuine, warm reply. Make them feel like someone actually read what they wrote.

How to approach it:
- If they're sharing a WIN → celebrate it specifically, not generically. What specifically is impressive? Say that.
- If they're struggling or venting → validate first. "yeah that's rough" lands better than advice. Show you actually get it.
- If they're asking something → answer honestly, add your real take, keep it conversational
- If they're sharing something they built or shipped → be genuinely stoked. Real enthusiasm, not hype.
- If it's a hot take or opinion → engage with the actual idea, add something to the conversation

DO NOT:
- Start with "I" or their @handle
- Say "great point", "well said", "love this", "so true", "100%", "absolutely", "totally"
- Give advice they didn't ask for
- Push back or correct them
- Sound like a bot summarising their tweet back to them

If the conversation naturally connects to what you're building (Phantom, BigRedDroid, Project Z) — mention it briefly, genuinely. Never force it.

Hard limit: 240 characters. COMPLETE sentence — if it doesn't fit, cut a point, not a word at the end.`,
    REPLY_SYSTEM,
    300
  );
}

export async function generateGoOutComment(tweetText: string) {
  return generate(
    `Someone tweeted: "${tweetText}"

Drop a short, warm comment that starts a real conversation. You're engaging because you actually find this interesting.

Pick ONE approach (whichever fits best):
- Validate something SPECIFIC from their tweet — not the whole thing, one detail that stood out ("the bit about X — yes, exactly that")
- Ask one genuinely curious question about something they mentioned ("how did you handle X when it happened?")
- Share a brief personal experience that actually connects ("went through exactly this — ended up doing X, helped a lot")

Rules:
- Do NOT start with "I" — start with the thing you're responding to
- Do NOT say "great post", "love this", "so true", "this is gold"
- Do NOT give advice. Do NOT correct them. Do NOT lecture.
- Be warm and human — like a builder who actually read it, not a bot
- If the topic connects to what you're building (Phantom / AI automation / X growth / building in public) weave it in naturally — just one clause, not a pitch
- COMPLETE thought only. If it's getting long, cut a point — never cut mid-sentence.

Hard limit: 180 characters total.`,
    REPLY_SYSTEM,
    240
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

export async function generateArticleThread(topic: string, recentTweets?: string[]) {
  const avoidBlock = recentTweets?.length
    ? `\n\nSTRICTLY FORBIDDEN — do not repeat the topic, angle, or opening of any of these:\n${recentTweets.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";
  const raw = await generate(
    `Write a 6-tweet educational thread about: "${topic}"${avoidBlock}

This should read like a genuinely useful article broken into tweets. Format:
- Tweet 1: Hook. One punchy sentence that stops the scroll. No "Thread:" or "1/".
- Tweets 2–5: The meat. Each tweet = one clear insight, tip, or step. Specific, not vague.
- Tweet 6: The honest takeaway or CTA. What to do next or why it matters.

Each tweet separated by "---"
Each tweet under 280 chars.
Write as ${X_HANDLE} — direct, confident, sounds like earned experience not generic advice.
Reference your own tools (Phantom, BigRedDroid, Project Z) only where it fits naturally.`,
    VOICE_SYSTEM_PROMPT,
    2000,
  );
  return raw.split("---").map(t => t.trim()).filter(Boolean);
}

export async function generateBuildUpdate(product: string, context?: string, recentTweets?: string[]) {
  const avoidBlock = recentTweets?.length
    ? `\n\nSTRICTLY FORBIDDEN — these have already been posted. Do NOT repeat the topic, angle, format, phrasing, or opening of ANY of these:\n${recentTweets.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nIf you find yourself writing anything similar, stop and pick a completely different angle and format.`
    : "";
  return generate(
    `Write a short "building in public" tweet about ${product}.${context ? `\n\nContext: ${context}` : ""}${avoidBlock}

Formats to rotate between (pick one randomly, but NEVER reuse a format from the forbidden list above):
- A specific thing that was shipped or fixed ("just shipped X — here's why it matters")
- A lesson learned while building ("the thing I didn't expect when building X was...")
- A behind-the-scenes detail ("here's how X actually works under the hood")
- A raw honest take ("day N building X — this is what it actually looks like")
- An engagement hook ("if you're building X, you need to know about...")
- A contrast or surprising stat ("most founders do X manually — I automated it in Phantom")
- A question that invites other builders to respond

Rules:
- Under 280 characters
- Specific, not vague — name real features, real problems, real decisions
- No "excited to share" or "thrilled to announce"
- Sound like a builder talking to other builders
- Every tweet must cover a completely different angle, format, and opening than all previous ones`,
    VOICE_SYSTEM_PROMPT,
    300
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
    `Write a short DM to @${recipientUsername}.
Context: ${context}

This is NOT a sales pitch. You're a solo founder asking a real person to try your product and tell you what they think.
The vibe: curious builder reaching out to another builder. You want honest feedback, not a conversion.

Rules:
- Mention what Phantom does in one clause — don't lead with it
- The actual ask: "would you try it and tell me what you think?" or "any feedback welcome"
- Reference something specific about them or their content (from context above)
- Under 280 characters
- No pitch. No "this will help you". No "I'd love to show you"
- Sounds like a real person, not a product announcement`,
    VOICE_SYSTEM_PROMPT,
    300
  );
}

export async function generateLongTweet(topic: string, recentTweets?: string[]) {
  const avoidBlock = recentTweets?.length
    ? `\n\nDo NOT repeat the angle, structure, or opening of any of these recent posts:\n${recentTweets.map((t, i) => `${i + 1}. ${t.slice(0, 100)}`).join("\n")}`
    : "";
  return generate(
    `Write a long-form X post about: ${topic}${avoidBlock}

This is a Premium+ post — can be up to 2000 characters. Use the space.
Format:
- First line: a single punchy hook (one sentence, no intro)
- One blank line
- 3–5 short paragraphs (2–4 lines each) — each one makes a distinct point
- No bullet lists. Flowing prose.
- Last paragraph: honest takeaway or open question (not a CTA, not "follow me for more")

Rules:
- 600–1800 characters total
- Mention Phantom, BigRedDroid, or Project Z where it fits naturally — not forced
- Sounds like a builder thinking out loud, not a newsletter
- No hashtags
- No "I've been thinking about..." opener`,
    VOICE_SYSTEM_PROMPT,
    600
  );
}
