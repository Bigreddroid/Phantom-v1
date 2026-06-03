// All personalisation comes from env vars.
// Clone the repo, set your own values in .env.local, and you're running your own Phantom.

function list(env: string | undefined, fallback: string[]): string[] {
  if (!env?.trim()) return fallback;
  return env.split(",").map(s => s.trim()).filter(Boolean);
}

// Search keywords used for engagement and follow loops
export const NICHE_KEYWORDS = list(
  process.env.NICHE_KEYWORDS,
  [
    "what are you building",
    "building in public",
    "BigRedDroid",
    "AI personal brand automation",
    "Claude AI automation",
    "X Twitter automation tool",
    "solopreneur AI tools",
    "Notion second brain",
    "Obsidian PKM",
    "founder personal brand",
    "automating content creation",
    "shipping 100 products",
    "indie builder AI",
    "AI tools for founders",
    "personal brand on autopilot",
  ]
);

// Content pillars used for tweet generation
export const CONTENT_TOPICS = list(
  process.env.CONTENT_TOPICS,
  [
    "Phantom — the AI system I built to automate my entire personal brand on X",
    "building Project Z in public — 92 products, starting with Phantom",
    "how Phantom uses Claude AI to write tweets, threads and replies in my voice",
    "shipping Phantom: what I learned building an X automation system without the paid API",
    "the Phantom stack: Next.js, Claude, Telegram bot, cookie-based X auth, Vercel crons",
    "why I built Phantom instead of paying for a social media tool",
    "building in public: what Phantom looks like after 30 days live",
    "how I use Claude AI + Obsidian + Notion as my second brain while building",
    "Phantom update: what shipped this week and what's next",
    "the honest truth about automating your personal brand with AI",
    "how Phantom handles tweet deduplication, approval flows and rate limits",
    "building 92 products alone — the system behind Project Z",
  ]
);

// Thread topic prompts (written as full angles, not just keywords)
export const THREAD_TOPICS = list(
  process.env.THREAD_TOPICS,
  [
    "how I built Phantom — an AI system that runs my entire X presence automatically",
    "the full Phantom tech stack: every tool, every decision, and why",
    "building Project Z: 92 products, one founder, no team",
    "how I use Claude AI to generate content that sounds like me (not a bot)",
    "Phantom's approval system: how I stay in control while automating everything",
    "5 things I learned building an X automation system from scratch",
    "how to build a personal brand on X without spending 3 hours a day on it",
    "the Obsidian + Notion + Claude workflow I use to build and document everything",
    "what building in public actually does for your audience — data from 30 days of Phantom",
    "why cookie-based X auth beats the paid API for indie builders",
  ]
);

// Comma-separated topics injected into the AI voice prompt
export const VOICE_TOPICS = process.env.VOICE_TOPICS
  ?? "Phantom (AI personal brand system), Project Z (building 92 products), Claude AI, Obsidian, Notion, building in public, solopreneur automation";

// Single letter shown in the OG image avatar circle
export const DISPLAY_INITIAL = (process.env.DISPLAY_INITIAL ?? "P")[0].toUpperCase();

// X handle — used in OG image, voice prompt, status dashboard
export const X_HANDLE = process.env.X_HANDLE ?? "@yourusername";
