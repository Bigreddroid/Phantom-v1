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
    "founder personal brand",
    "building in public",
    "solopreneur automation",
    "AI tools for creators",
    "indiehacker",
    "personal brand tips",
    "indie founder growth",
    "content creator tools",
    "creator economy",
    "startup founder",
  ]
);

// Content pillars used for tweet generation
export const CONTENT_TOPICS = list(
  process.env.CONTENT_TOPICS,
  [
    "building a personal brand as a founder",
    "AI automation for solopreneurs",
    "lessons from building in public",
    "growing an audience without spending money on ads",
    "the intersection of tech and personal branding",
  ]
);

// Thread topic prompts (written as full angles, not just keywords)
export const THREAD_TOPICS = list(
  process.env.THREAD_TOPICS,
  [
    "how I'm building a personal brand from scratch using AI",
    "5 automation tools every founder should know about",
    "what building in public actually looks like day to day",
    "the solopreneur's guide to content without burning out",
    "the exact system I use to automate my personal brand",
    "why most founders fail at content — and how to fix it",
  ]
);

// Comma-separated topics injected into the AI voice prompt
export const VOICE_TOPICS = process.env.VOICE_TOPICS
  ?? "personal branding, AI automation, building in public, solopreneur life";

// Single letter shown in the OG image avatar circle
export const DISPLAY_INITIAL = (process.env.DISPLAY_INITIAL ?? "P")[0].toUpperCase();

// X handle — used in OG image, voice prompt, status dashboard
export const X_HANDLE = process.env.X_HANDLE ?? "@yourusername";
