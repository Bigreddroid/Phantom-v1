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
    // Build updates — raw, specific, credible
    "Phantom — the AI system I built to automate my entire personal brand on X",
    "building BigRedDroid in public — Phantom is live, what's next",
    "Phantom update: what shipped this week and what broke along the way",
    "the honest reality of building Phantom alone — what nobody talks about",
    "day-in-the-life: what it actually looks like running Phantom on autopilot",
    // Hot takes — drive replies
    "hot take: most AI automation tools aren't actually automated",
    "why 99% of founders fail at building in public before they start",
    "the mistake I made in the first 30 days of building Phantom",
    "unpopular opinion: your personal brand is more important than your product",
    "why I stopped trying to go viral and started building systems instead",
    // Educational — positions as expert
    "how I use Claude AI as a second brain while building in public",
    "the exact stack I use to run Phantom: Next.js, Claude, Telegram, Vercel, Prisma",
    "how cookie-based X automation works — and why it beats the paid API for indie builders",
    "the Obsidian + Claude workflow that replaced 3 tools for me",
    // Results / social proof
    "what 30 days of automated engagement actually does to an X account",
    "I let AI run my X account for 30 days — here's what happened",
    // Engagement hooks — questions, polls, curiosity
    "what are you building right now — I want to know",
    "the thing that surprised me most about building Phantom alone",
    "would you trust an AI to run your personal brand? I do.",
    "why I built Phantom instead of paying $200/month for a social media tool",
  ]
);

// Thread topic prompts (written as full angles, not just keywords)
export const THREAD_TOPICS = list(
  process.env.THREAD_TOPICS,
  [
    // How-I-built (founder credibility)
    "how I built Phantom — an AI system that runs my entire X presence automatically",
    "the full Phantom tech stack: every tool, every decision, and why I chose each one",
    "building BigRedDroid: one founder, no team, shipping in public — the real story",
    "how I use Claude AI to generate content that actually sounds like me, not a bot",
    // Tactical value (gets saves + shares)
    "5 things I wish I knew before building in public on X",
    "how to automate your personal brand on X without losing your voice",
    "the system I use to ship products while still building an audience",
    "how to use Claude as a second brain — the exact workflow I run daily",
    "why most founders fail at content and the simple fix that changed everything for me",
    // Results / proof
    "what building in public for 30 days actually did to my account — raw data",
    "I automated my entire X presence with AI — here's exactly how it works",
    // Hot take threads (high engagement)
    "7 uncomfortable truths about building a personal brand as a solo founder",
    "why I think most 'AI automation' advice is wrong — and what actually works",
    "the 5 mistakes every indie maker makes in their first 90 days",
    // Niche authority
    "the Obsidian + Notion + Claude workflow behind BigRedDroid",
    "why cookie-based X auth is better than the paid API for 90% of indie builders",
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
  "Notion as a second brain: the exact database setup I use for BigRedDroid",
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
  "shipping Phantom: the mindset and systems behind building a product solo",
  "the solopreneur productivity stack I run on $50/month",
  "why I chose depth over breadth when building under BigRedDroid",
];

// Comma-separated topics injected into the AI voice prompt
export const VOICE_TOPICS = process.env.VOICE_TOPICS
  ?? "Phantom (AI personal brand system), BigRedDroid (solo product lab), Claude AI, Obsidian, Notion, building in public, solopreneur automation";

// Single letter shown in the OG image avatar circle
export const DISPLAY_INITIAL = (process.env.DISPLAY_INITIAL ?? "P")[0].toUpperCase();

// X handle — used in OG image, voice prompt, status dashboard
export const X_HANDLE = process.env.X_HANDLE ?? "@yourusername";
