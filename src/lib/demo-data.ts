export const DEMO = process.env.DEMO_MODE === "true";

const now = Date.now();
const ago = (ms: number) => new Date(now - ms).toISOString();

export const DEMO_STATS = {
  followers: 2847,
  following: 1203,
  tweets: 412,
  engagements: 1894,
  dmsSent: 38,
  liPosts: 24,
  linkedInConnected: true,
  linkedInExpiry: ago(-86400000 * 10), // 10 days from now
  paused: false,
};

export const DEMO_QUEUE = [
  {
    id: "demo-1",
    type: "Tweet",
    content: "Most founders underestimate how much their personal brand compounds. You're not just posting — you're building search results, trust signals, and inbound for the next 5 years.",
    status: "PENDING",
    metadata: { withImage: true },
    createdAt: ago(4 * 60000),
  },
  {
    id: "demo-2",
    type: "Tweet",
    content: "The best productivity system is one you actually use. I've tried everything and ended up back on a notes app and a calendar. Don't overthink it.",
    status: "PENDING",
    metadata: { withImage: false },
    createdAt: ago(18 * 60000),
  },
  {
    id: "demo-3",
    type: "Thread",
    content: "How I automated my entire personal brand using AI — and what I learned:\n---\nI used to spend 3 hours a week on content. Now I spend 20 minutes approving drafts my system generates.\n---\nHere's the exact stack:\n- Claude for generation\n- Telegram for approvals\n- Vercel crons for scheduling\n- Cookie auth so I don't need a paid X API\n---\nThe hardest part wasn't the tech. It was figuring out my voice well enough to write a prompt that sounds like me.\n---\nIf your AI content sounds generic, the prompt is the problem — not the model.",
    status: "PENDING",
    metadata: { cron: false },
    createdAt: ago(35 * 60000),
  },
  {
    id: "demo-4",
    type: "Tweet",
    content: "Automation doesn't replace authenticity. It gives you bandwidth to be more authentic — because you're not grinding out content at midnight anymore.",
    status: "PENDING",
    metadata: { withImage: false },
    createdAt: ago(52 * 60000),
  },
];

export const DEMO_ACTIVITY = [
  { id: "a1",  action: "Tweet posted",       detail: "Most founders underestimate how much their personal brand compounds…",   icon: "🐦", createdAt: ago(3 * 60000) },
  { id: "a2",  action: "Replied to mention", detail: "mid:1234567890|Great point — the compounding effect is real after month 3", icon: "💬", createdAt: ago(9 * 60000) },
  { id: "a3",  action: "Engagement run",     detail: "❤️ 6 · 🔁 1 · 💬 4 · \"building in public\"",                          icon: "⚡", createdAt: ago(15 * 60000) },
  { id: "a4",  action: "Retweeted",          detail: "rt:9876543210|Shipped 3 features this week. No meetings. No standups.",   icon: "🔁", createdAt: ago(16 * 60000) },
  { id: "a5",  action: "Go-out comment",     detail: "tid:1122334455|This is the part most people skip — validation before build", icon: "🗣️", createdAt: ago(22 * 60000) },
  { id: "a6",  action: "LinkedIn post",      detail: "Why I stopped writing long-form content and what replaced it",             icon: "💼", createdAt: ago(28 * 60000) },
  { id: "a7",  action: "Followed user",      detail: "@levelsio",                                                                icon: "🤝", createdAt: ago(34 * 60000) },
  { id: "a8",  action: "Engagement run",     detail: "❤️ 5 · 🔁 0 · 💬 3 · \"solopreneur automation\"",                       icon: "⚡", createdAt: ago(45 * 60000) },
  { id: "a9",  action: "Tweet posted",       detail: "Automation doesn't replace authenticity. It gives you bandwidth…",        icon: "🐦", createdAt: ago(62 * 60000) },
  { id: "a10", action: "Replied to mention", detail: "mid:5566778899|Been doing this for 6 months — the key is consistency",    icon: "💬", createdAt: ago(78 * 60000) },
  { id: "a11", action: "Go-out comment",     detail: "tid:6677889900|Exactly. The tools aren't the bottleneck anymore",          icon: "🗣️", createdAt: ago(94 * 60000) },
  { id: "a12", action: "Engagement run",     detail: "❤️ 8 · 🔁 2 · 💬 5 · \"founder personal brand\"",                       icon: "⚡", createdAt: ago(120 * 60000) },
  { id: "a13", action: "Thread posted",      detail: "How I automated my entire personal brand using AI — and what I learned",  icon: "🧵", createdAt: ago(150 * 60000) },
  { id: "a14", action: "NicheRT queued",     detail: "Queued retweet: \"Shipped v2 of my SaaS…\"",                              icon: "🔁", createdAt: ago(180 * 60000) },
  { id: "a15", action: "Daily summary sent", detail: "+12 followers · 3 tweets · 23 engagements",                               icon: "📊", createdAt: ago(240 * 60000) },
];
