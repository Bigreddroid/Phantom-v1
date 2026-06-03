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

// Article thread topics — research-backed for traction in AI/automation/tools space
// Topics modelled on what consistently performs: Claude tips, Notion/Obsidian workflows,
// founder productivity, AI tool comparisons, building-in-public behind-the-scenes.
export const ARTICLE_TOPICS = [
  // Claude AI
  "5 Claude prompts that replaced an entire VA for me (with examples)",
  "Claude vs GPT-4 for building products: what I actually found after months of use",
  "how to write a Claude system prompt that sounds like you, not a robot",
  "the Claude workflow I use to go from idea to shipped feature in one sitting",
  "Claude + code: how I use it to build entire features without senior dev experience",
  // Notion
  "the Notion setup that runs my entire product studio (template inside)",
  "how I use Notion AI to turn raw notes into published content in 10 minutes",
  "stop building complex Notion systems — here is the only structure you need as a solopreneur",
  "Notion as a second brain: the exact database setup I use for Project Z",
  // Obsidian
  "why I switched from Notion to Obsidian for thinking — and use both for different things",
  "the Obsidian + Claude workflow that replaced journaling, note-taking, and planning apps",
  "how to build a personal knowledge graph in Obsidian without spending days on setup",
  "Obsidian for founders: how I never lose a product idea or customer insight",
  // AI Automation
  "the 7 things I automated first as a solo founder (and what order to do it in)",
  "how to build an AI agent that runs your Twitter while you sleep — what I actually did",
  "AI automation stack for indie builders: what I use, what I dropped, and what I am building",
  "building a personal brand on autopilot: the full system behind Phantom",
  "why most founders fail at AI automation (and the one shift that changes everything)",
  // X / Personal Brand
  "how to grow on X in 2025 without posting 5 times a day manually",
  "the content system that lets me post 4 times a day without thinking about it",
  "building in public: what actually works vs. what just gets likes",
  "how I approach X engagement differently from everyone else (and why it compounds)",
  // Solopreneur / Founder
  "shipping 92 products alone: the mindset and systems behind Project Z",
  "the solopreneur productivity stack I run on $50/month",
  "why I chose depth over breadth when building under BigRedDroid",
];

// Comma-separated topics injected into the AI voice prompt
export const VOICE_TOPICS = process.env.VOICE_TOPICS
  ?? "Phantom (AI personal brand system), Project Z (building 92 products), Claude AI, Obsidian, Notion, building in public, solopreneur automation";

// Single letter shown in the OG image avatar circle
export const DISPLAY_INITIAL = (process.env.DISPLAY_INITIAL ?? "P")[0].toUpperCase();

// X handle — used in OG image, voice prompt, status dashboard
export const X_HANDLE = process.env.X_HANDLE ?? "@yourusername";
