"use client";

import { useEffect, useState, useCallback } from "react";

type QueueItem = { id: string; type: string; content: string; status: string; createdAt: string };
type ActivityItem = { id: string; action: string; detail?: string; icon?: string; createdAt: string };
type Stats = {
  followers: number; following: number; tweets: number; engagements: number;
  dmsSent: number; liPosts?: number; linkedInConnected?: boolean; linkedInExpiry?: string | null;
  paused?: boolean;
};

const SETUP_GROUPS = [
  {
    title: "X (Twitter) API", href: "https://developer.x.com", hintText: "developer.x.com",
    guide: [
      "Go to developer.x.com and sign in with your X account",
      "Create a new Project + App (Free tier is enough)",
      "In your app → Settings: set User authentication, enable Read + Write",
      "In Keys & Tokens: copy API Key, API Secret, Bearer Token",
      "Generate Access Token & Access Token Secret (must be after enabling Read+Write)",
    ],
    keys: [
      { key: "X_API_KEY",             required: true,  hint: "App → Keys & Tokens → Consumer Keys" },
      { key: "X_API_SECRET",          required: true,  hint: "App → Keys & Tokens → Consumer Keys" },
      { key: "X_BEARER_TOKEN",        required: true,  hint: "App → Keys & Tokens → Bearer Token" },
      { key: "X_ACCESS_TOKEN",        required: true,  hint: "Generate after enabling Read+Write permissions" },
      { key: "X_ACCESS_TOKEN_SECRET", required: true,  hint: "Generated alongside Access Token — shown once" },
      { key: "X_CLIENT_ID",           required: false, hint: "App → Keys & Tokens → OAuth 2.0 Client ID" },
      { key: "X_CLIENT_SECRET",       required: false, hint: "Same section — optional unless you need OAuth 2.0" },
      { key: "X_USER_ID",             required: false, hint: "Find yours at tweeterid.com" },
    ],
  },
  {
    title: "LinkedIn", href: "https://developer.linkedin.com", hintText: "developer.linkedin.com",
    guide: [
      "Go to developer.linkedin.com → My Apps → Create app",
      "In Products tab: request access to 'Share on LinkedIn' (instant approval)",
      "In Auth tab: copy Client ID and Client Secret 1",
      "Add Authorized Redirect URL: https://your-app.vercel.app/api/auth/linkedin/callback",
    ],
    keys: [
      { key: "LINKEDIN_CLIENT_ID",     required: false, hint: "App → Auth tab → Application credentials" },
      { key: "LINKEDIN_CLIENT_SECRET", required: false, hint: "Client Secret 1 — rotate every 12 months" },
    ],
  },
  {
    title: "AI", href: null as string | null, hintText: null as string | null,
    guide: [
      "Anthropic (required): console.anthropic.com → API Keys → Create Key",
      "Grok (optional): console.x.ai → API Keys → Create. Falls back to Claude if not set",
    ],
    keys: [
      { key: "ANTHROPIC_API_KEY", required: true,  hint: "console.anthropic.com → API Keys" },
      { key: "GROK_API_KEY",      required: false, hint: "console.x.ai — better for tweet generation" },
    ],
  },
  {
    title: "Telegram Bot", href: null as string | null, hintText: null as string | null,
    guide: [
      "Message @BotFather → /newbot → follow prompts → copy the token",
      "Message @userinfobot — it replies with your numeric Chat ID",
      "After setting env vars, send /setup to your bot to register the webhook",
    ],
    keys: [
      { key: "TELEGRAM_BOT_TOKEN", required: true, hint: "@BotFather → /newbot → token" },
      { key: "TELEGRAM_CHAT_ID",   required: true, hint: "Message @userinfobot — numeric ID" },
    ],
  },
  {
    title: "Database", href: "https://supabase.com", hintText: "supabase.com",
    guide: [
      "supabase.com → New project (free tier works)",
      "Settings → Database → Connection string → URI",
      "Replace [YOUR-PASSWORD] with your project password",
    ],
    keys: [
      { key: "DATABASE_URL", required: true, hint: "postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres" },
    ],
  },
  {
    title: "App Secrets", href: null as string | null, hintText: null as string | null,
    guide: [
      `Generate: node -e "require('crypto').randomBytes(32).toString('hex')"`,
      "NEXTAUTH_URL: http://localhost:3000 locally, production URL on Vercel",
      "CRON_SECRET: also add to GitHub → Settings → Secrets → CRON_SECRET",
    ],
    keys: [
      { key: "NEXTAUTH_SECRET", required: true,  hint: "Random 32-byte hex — signs session tokens" },
      { key: "NEXTAUTH_URL",    required: true,  hint: "Must be your production Vercel URL" },
      { key: "CRON_SECRET",     required: true,  hint: "Bearer token for GitHub Actions → add to repo Secrets" },
    ],
  },
  {
    title: "Personalisation", href: null as string | null, hintText: "All optional",
    guide: [
      "X_HANDLE / NEXT_PUBLIC_X_HANDLE: your @username (same value, both needed)",
      "NICHE_KEYWORDS: comma-separated search terms for engagement + follow loops",
      "CONTENT_TOPICS / THREAD_TOPICS: full sentences work best",
    ],
    keys: [
      { key: "X_HANDLE",             required: false, hint: "e.g. @yourusername" },
      { key: "NEXT_PUBLIC_X_HANDLE", required: false, hint: "Same as X_HANDLE — needed for client-side rendering" },
      { key: "DISPLAY_INITIAL",      required: false, hint: "Single letter for avatar in OG images" },
      { key: "NICHE_KEYWORDS",       required: false, hint: "e.g. founder personal brand,solopreneur automation" },
      { key: "CONTENT_TOPICS",       required: false, hint: "Full sentences: e.g. lessons from building in public" },
      { key: "THREAD_TOPICS",        required: false, hint: "Angles for thread generation" },
      { key: "VOICE_TOPICS",         required: false, hint: "Short comma list: e.g. personal branding, AI automation" },
      { key: "BLOCKED_USERNAMES",    required: false, hint: "Comma-separated — Phantom skips these accounts" },
      { key: "BLOCKED_IDS",          required: false, hint: "Numeric Twitter IDs — more reliable than usernames" },
    ],
  },
];

const POST_SETUP_STEPS = [
  { step: "npx prisma db push",          desc: "Push schema to your database" },
  { step: "npx prisma generate",         desc: "Generate the Prisma client" },
  { step: "/setup in your Telegram bot", desc: "Register webhook + command menu" },
  { step: "GitHub Actions → Secrets",    desc: "Add APP_URL and CRON_SECRET" },
  { step: "/linkedin → Connect account", desc: "Authorize LinkedIn to enable Phase 2" },
];

const ENV_TEMPLATE = `# X (Twitter) API
X_API_KEY=
X_API_SECRET=
X_BEARER_TOKEN=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=
X_USER_ID=

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# AI
ANTHROPIC_API_KEY=
GROK_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Database
DATABASE_URL=

# App
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
CRON_SECRET=

# Personalisation
X_HANDLE=@yourusername
NEXT_PUBLIC_X_HANDLE=@yourusername
DISPLAY_INITIAL=Y
NICHE_KEYWORDS=
CONTENT_TOPICS=
THREAD_TOPICS=
VOICE_TOPICS=
BLOCKED_USERNAMES=
BLOCKED_IDS=
`;

const X_JOBS = [
  { label: "Queue Tweet",    endpoint: "/api/jobs/tweet",     icon: "🐦", note: "previews in Telegram" },
  { label: "Queue Thread",   endpoint: "/api/jobs/thread",    icon: "🧵", note: "previews in Telegram" },
  { label: "Engage",         endpoint: "/api/jobs/engage",    icon: "⚡", note: "likes + replies"      },
  { label: "Check Mentions", endpoint: "/api/jobs/mentions",  icon: "💬", note: "auto-reply"           },
  { label: "Resurface",      endpoint: "/api/jobs/resurface", icon: "🔁", note: "old tweet revival"    },
];

const LI_JOBS = [
  { label: "Post",      endpoint: "/api/jobs/linkedin",       icon: "✍️", desc: "Thought leadership" },
  { label: "Story",     endpoint: "/api/jobs/linkedin-story", icon: "📖", desc: "Personal narrative"  },
  { label: "5 Lessons", endpoint: "/api/jobs/linkedin-list",  icon: "📋", desc: "Numbered list post"  },
];

const SCHEDULE = [
  { job: "Tweets",        emoji: "🐦", times: "7:30am · 12:30pm · 6:30pm · 9:30pm IST", freq: "4×/day",   note: "approval-gated via Telegram",             red: true  },
  { job: "Threads",       emoji: "🧵", times: "Mon & Thu · 2:30pm IST",                  freq: "2×/week",  note: "approval-gated via Telegram",             red: false },
  { job: "Engagement",    emoji: "⚡", times: "Every 15 min · 24/7",                     freq: "96×/day",  note: "likes + replies · traction score ≥5",     red: true  },
  { job: "Follow",        emoji: "🤝", times: "9:30am · 3:30pm · 8:30pm IST",            freq: "3×/day",   note: "niche accounts · like + follow + reply",  red: false },
  { job: "Mentions",      emoji: "💬", times: "Every 15 min",                            freq: "96×/day",  note: "auto-replies to all mentions",            red: false },
  { job: "LinkedIn",      emoji: "💼", times: "Tue–Fri · 8:30am IST",                    freq: "4×/week",  note: "original thought leadership post",        red: false },
  { job: "Resurface",     emoji: "🔁", times: "Daily · 10:30am IST",                     freq: "1×/day",   note: "quote-tweet top old content · score ≥1",  red: true  },
  { job: "Niche RT",      emoji: "↩️", times: "Daily · 4:30pm IST",                     freq: "1×/day",   note: "retweet niche post · score ≥20",          red: false },
  { job: "Auto Comments", emoji: "🗣️", times: "9am · 11am · 2pm · 5pm · 8pm IST",      freq: "5×/day",   note: "drops on high-traction AI threads ≥10",   red: true  },
  { job: "Auto DM",       emoji: "📨", times: "Daily · 1:30pm IST",                      freq: "1×/day",   note: "personalised DM · approval before send",  red: false },
  { job: "Summary",       emoji: "📊", times: "Daily · 11:30pm IST",                     freq: "1×/day",   note: "Telegram report with follower gain",       red: false },
];

function platformBadge(icon?: string) {
  if (!icon) return null;
  return ["💼", "🔗"].includes(icon) ? "li" : "x";
}

function fmt(n: number | string | undefined) {
  if (n === undefined || n === null || n === "—") return "—";
  if (typeof n === "number" && n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"queue" | "activity" | "schedule" | "settings">("queue");
  const [stats, setStats]         = useState<Stats | null>(null);
  const [queue, setQueue]         = useState<QueueItem[]>([]);
  const [activity, setActivity]   = useState<ActivityItem[]>([]);
  const [loading, setLoading]     = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [setupStatus, setSetupStatus] = useState<Record<string, boolean> | null>(null);
  const [liSetupModal, setLiSetupModal] = useState(false);

  const openLiConnect = () => {
    if (setupStatus?.["LINKEDIN_CLIENT_ID"]) {
      window.location.href = "/api/auth/linkedin";
    } else {
      window.open("https://developer.linkedin.com/apps", "_blank", "noopener");
      setLiSetupModal(true);
    }
  };

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    const [s, q, a] = await Promise.all([
      fetch("/api/stats").then(r => r.json()).catch(() => null),
      fetch("/api/queue").then(r => r.json()).catch(() => []),
      fetch("/api/activity").then(r => r.json()).catch(() => []),
    ]);
    if (s && !s.error) setStats(s);
    setQueue(Array.isArray(q) ? q : []);
    setActivity(Array.isArray(a) ? a : []);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 15000); return () => clearInterval(t); }, [fetchAll]);
  useEffect(() => { fetch("/api/setup").then(r => r.json()).then(setSetupStatus).catch(() => {}); }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const li = p.get("li");
    if (li === "connected")   { showToast("LinkedIn connected"); setActiveTab("settings"); }
    else if (li === "needs_setup")  setLiSetupModal(true);
    else if (li === "denied") showToast("LinkedIn authorization denied", "err");
    else if (["token_error","profile_error","invalid"].includes(li ?? "")) showToast("LinkedIn auth failed — try again", "err");
    if (li) window.history.replaceState({}, "", "/");
  }, []);

  const runJob = async (endpoint: string, label: string) => {
    setLoading(label);
    try {
      const data = await fetch(endpoint, { method: "POST" }).then(r => r.json());
      data.error ? showToast(data.error, "err") : showToast(`${label} triggered`);
      await fetchAll();
    } catch { showToast("Something went wrong", "err"); }
    setLoading(null);
  };

  const handleQueue = async (id: string, action: "approve" | "reject") => {
    setLoading(id);
    await fetch("/api/queue", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    showToast(action === "approve" ? "Posted to X" : "Rejected");
    await fetchAll();
    setLoading(null);
  };

  const handle     = process.env.NEXT_PUBLIC_X_HANDLE ?? "@yourusername";
  const liConnected    = stats?.linkedInConnected ?? false;
  const liExpiringSoon = stats?.linkedInExpiry ? (new Date(stats.linkedInExpiry).getTime() - Date.now()) < 7 * 86400000 : false;
  const isPaused   = stats?.paused ?? false;
  const appUrl     = typeof window !== "undefined" ? window.location.origin : "";

  const togglePause = async () => {
    const action = isPaused ? "resume" : "pause";
    await fetch("/api/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    showToast(action === "pause" ? "Automation paused" : "Automation resumed");
    await fetchAll();
  };

  return (
    <div className="min-h-screen bg-[#090909] text-white font-sans antialiased">

      {/* Red accent line — top of page */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent z-50 opacity-80" />

      {/* Paused banner */}
      {isPaused && (
        <div className="fixed top-[2px] left-0 right-0 z-40 bg-red-950/95 border-b border-red-800/50 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-6 h-9 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-sm">⏸</span>
              <p className="text-sm font-semibold text-red-300">Automation paused — all cron jobs are skipping</p>
            </div>
            <button onClick={togglePause} className="text-xs font-bold text-red-400 hover:text-white border border-red-700/60 px-3 py-1 rounded-lg transition-colors hover:bg-red-600/20">
              Resume →
            </button>
          </div>
        </div>
      )}

      {/* LinkedIn Setup Modal */}
      {liSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#111] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center justify-center text-sm font-bold text-white/50">in</div>
                <div>
                  <p className="font-semibold text-sm">Connect LinkedIn</p>
                  <p className="text-xs text-white/35 mt-0.5">One-time setup · 5 minutes</p>
                </div>
              </div>
              <button onClick={() => setLiSetupModal(false)} className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/40 hover:text-white/70 flex items-center justify-center text-lg leading-none transition-colors">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {[
                { n:1, title:"Create a LinkedIn App", body:"developer.linkedin.com → My Apps → Create app. Add name, company page, and logo.", link:{ label:"Open LinkedIn Developer Portal →", href:"https://developer.linkedin.com/apps" } },
                { n:2, title:"Enable 'Share on LinkedIn'", body:"Products tab → find 'Share on LinkedIn' → Request access. Approval is instant." },
                { n:3, title:"Copy credentials", body:"Auth tab → copy Client ID and Client Secret 1. These go into Vercel as env vars." },
                { n:4, title:"Add the redirect URL", body:"Auth tab → Authorized Redirect URLs → add exactly:", code:`${appUrl}/api/auth/linkedin/callback` },
                { n:5, title:"Add env vars to Vercel", body:"Vercel project → Settings → Environment Variables.", link:{ label:"Open Vercel Dashboard →", href:"https://vercel.com/dashboard" }, code2:"LINKEDIN_CLIENT_ID\nLINKEDIN_CLIENT_SECRET" },
                { n:6, title:"Redeploy & Try Again", body:"After adding env vars, trigger a redeploy. Then come back and click Try Again." },
              ].map(s => (
                <div key={s.n} className="flex gap-3.5">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 text-[11px] font-bold flex items-center justify-center mt-0.5">{s.n}</span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium text-white/80">{s.title}</p>
                    <p className="text-xs text-white/40 leading-relaxed">{s.body}</p>
                    {s.code && (
                      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2">
                        <code className="text-xs text-red-300/80 font-mono flex-1 break-all">{s.code}</code>
                        <button onClick={() => { navigator.clipboard.writeText(s.code!); showToast("Copied"); }} className="shrink-0 text-[10px] text-white/30 hover:text-white/60 border border-white/[0.08] rounded px-2 py-0.5 transition-colors">copy</button>
                      </div>
                    )}
                    {s.code2 && (
                      <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 space-y-1">
                        {s.code2.split("\n").map(k => <code key={k} className="block text-xs text-white/50 font-mono">{k}</code>)}
                      </div>
                    )}
                    {s.link && <a href={s.link.href} target="_blank" rel="noreferrer" className="inline-flex text-xs text-white/35 hover:text-white/60 transition-colors">{s.link.label}</a>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.07] bg-white/[0.01]">
              <button onClick={() => setLiSetupModal(false)} className="text-sm text-white/30 hover:text-white/55 transition-colors">Do this later</button>
              <div className="flex gap-2">
                <button onClick={() => { setLiSetupModal(false); setActiveTab("settings"); }} className="px-4 py-2 text-sm border border-white/[0.08] rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors">View Settings</button>
                <a href="/api/auth/linkedin" className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors">Try Again →</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 text-sm font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border ${
          toast.type === "err" ? "bg-red-950 border-red-800/50 text-red-300" : "bg-[#1a1a1a] border-white/[0.10] text-white"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${toast.type === "err" ? "bg-red-500" : "bg-red-500"}`} />
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className={`sticky z-40 border-b border-white/[0.06] bg-[#090909]/95 backdrop-blur-md ${isPaused ? "top-9" : "top-[2px]"}`}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div className="relative w-8 h-8 shrink-0">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-600 to-red-900 shadow-lg shadow-red-900/40" />
              <svg className="absolute inset-0 w-full h-full p-1.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="2" fill="white" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-[16px] tracking-tight">PHANTOM</span>
              <span className="text-[11px] text-white/30 font-mono mt-0.5">{handle}</span>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-white/45">
              <span className="font-black text-white/60">𝕏</span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            </div>
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
              liConnected
                ? liExpiringSoon ? "bg-red-500/10 border-red-500/25 text-red-400" : "bg-white/[0.05] border-white/[0.09] text-white/45"
                : "bg-white/[0.02] border-white/[0.05] text-white/20"
            }`}>
              <span className="font-bold text-[11px]">in</span>
              <span className={`w-1.5 h-1.5 rounded-full ${liConnected ? (liExpiringSoon ? "bg-red-400" : "bg-white/35") : "bg-white/15"}`} />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium ${
              refreshing ? "border-white/[0.10] bg-white/[0.04] text-white/40" : "border-red-500/30 bg-red-500/8 text-red-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? "bg-white/30 animate-pulse" : "bg-red-500"}`} />
              {refreshing ? "Syncing" : "Live"}
            </div>

            {/* Pause / Resume toggle */}
            <button
              onClick={togglePause}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-bold transition-all ${
                isPaused
                  ? "border-red-600/50 bg-red-600/15 text-red-400 hover:bg-red-600/25"
                  : "border-white/[0.08] bg-white/[0.03] text-white/35 hover:text-white/65 hover:bg-white/[0.06]"
              }`}
            >
              {isPaused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: "Followers",   value: stats?.followers,   badge: "𝕏", red: true  },
            { label: "Tweets",      value: stats?.tweets,      badge: "𝕏", red: false },
            { label: "Engagements", value: stats?.engagements, badge: "𝕏", red: true  },
            { label: "DMs Sent",    value: stats?.dmsSent,     badge: "𝕏", red: false },
            { label: "LI Posts",    value: stats?.liPosts,     badge: "in", red: false },
          ].map(s => (
            <div key={s.label} className={`relative rounded-2xl border bg-[#111] p-5 group hover:border-white/[0.13] transition-colors ${
              s.red ? "border-red-500/20 hover:border-red-500/30" : "border-white/[0.07]"
            }`}>
              {s.red && <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />}
              <p className="text-[10px] uppercase tracking-widest font-semibold text-white/30 mb-3">{s.label}</p>
              <p className={`text-3xl font-black tabular-nums tracking-tight ${s.red ? "text-red-400" : "text-white/75"}`}>{fmt(s.value)}</p>
              <span className={`absolute top-4 right-4 text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                s.badge === "in" ? "bg-white/[0.06] text-white/25" : "bg-white/[0.05] text-white/20"
              }`}>{s.badge}</span>
            </div>
          ))}
        </div>

        {/* ── Quick Actions ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111] divide-y divide-white/[0.05]">

          {/* X Actions */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-black tracking-widest uppercase text-white/20 bg-white/[0.06] px-2 py-0.5 rounded">𝕏 Actions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {X_JOBS.map(job => (
                <button
                  key={job.label}
                  onClick={() => runJob(job.endpoint, job.label)}
                  disabled={!!loading}
                  className="group flex items-center gap-2.5 pl-3 pr-4 py-2.5 bg-white/[0.03] hover:bg-red-500/8 border border-white/[0.07] hover:border-red-500/25 rounded-xl text-sm text-white/55 hover:text-white/90 transition-all disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  {loading === job.label ? (
                    <><span className="w-3.5 h-3.5 border border-white/20 border-t-red-500 rounded-full animate-spin" /><span className="text-white/30 text-xs">Running…</span></>
                  ) : (
                    <>
                      <span className="text-[16px] leading-none">{job.icon}</span>
                      <span className="flex flex-col items-start">
                        <span className="font-medium text-[13px] leading-tight">{job.label}</span>
                        <span className="text-[10px] text-white/25 group-hover:text-white/40 leading-tight transition-colors">{job.note}</span>
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* LinkedIn Actions */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-black tracking-widest uppercase text-white/20 bg-white/[0.06] px-2 py-0.5 rounded">in LinkedIn</span>
              {!liConnected && (
                <button
                  onClick={openLiConnect}
                  className="text-[11px] font-medium text-red-400/80 hover:text-red-400 border border-red-500/20 bg-red-500/8 px-3 py-1 rounded-lg transition-colors"
                >Connect →</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {LI_JOBS.map(job => (
                <button
                  key={job.label}
                  onClick={() => { if (!liConnected) { showToast("Connect LinkedIn first", "err"); return; } runJob(job.endpoint, job.label); }}
                  disabled={!!loading}
                  className={`group flex items-center gap-2.5 pl-3 pr-4 py-2.5 border rounded-xl text-sm transition-all disabled:opacity-25 disabled:cursor-not-allowed active:scale-[0.97] ${
                    liConnected
                      ? "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.07] hover:border-white/[0.13] text-white/55 hover:text-white/85"
                      : "bg-white/[0.02] border-white/[0.04] text-white/20 cursor-not-allowed"
                  }`}
                >
                  {loading === job.label ? (
                    <><span className="w-3.5 h-3.5 border border-white/20 border-t-white/60 rounded-full animate-spin" /><span className="text-white/25 text-xs">Running…</span></>
                  ) : (
                    <>
                      <span className="text-[16px] leading-none">{job.icon}</span>
                      <span className="flex flex-col items-start">
                        <span className="font-medium text-[13px] leading-tight">{job.label}</span>
                        <span className="text-[10px] text-white/25 leading-tight">{job.desc}</span>
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div>
          <div className="flex gap-1 mb-5 bg-[#111] border border-white/[0.07] rounded-xl p-1 w-fit">
            {(["queue","activity","schedule","settings"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-2 rounded-lg text-[13px] capitalize font-semibold transition-all ${
                  activeTab === tab
                    ? "bg-red-600 text-white shadow-md shadow-red-900/50"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                {tab}
                {tab === "queue" && queue.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-black bg-white text-red-600 rounded-full">{queue.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Queue ── */}
          {activeTab === "queue" && (
            <div className="space-y-2.5">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#111] border border-white/[0.07] flex items-center justify-center text-2xl">📭</div>
                  <div>
                    <p className="text-white/40 text-sm font-medium">Queue is empty</p>
                    <p className="text-white/20 text-xs mt-1">Trigger a job above to generate content for approval</p>
                  </div>
                </div>
              ) : queue.map(item => (
                <div key={item.id} className="flex items-start gap-4 bg-[#111] border border-white/[0.07] hover:border-white/[0.11] rounded-2xl overflow-hidden transition-colors">
                  <div className="w-1 self-stretch bg-red-600 shrink-0" />
                  <div className="flex-1 min-w-0 py-4 pr-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-400/80">{item.type}</span>
                      <span className="text-[10px] text-white/20 font-mono">{new Date(item.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>
                    </div>
                    <p className="text-sm text-white/70 whitespace-pre-line line-clamp-4 leading-relaxed">{item.content}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 py-4 pr-4 shrink-0">
                    <button
                      onClick={() => handleQueue(item.id, "approve")}
                      disabled={loading === item.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs rounded-xl font-bold transition-colors disabled:opacity-40 shadow-sm shadow-red-900/40 whitespace-nowrap"
                    >{loading === item.id ? "…" : "Post →"}</button>
                    <button
                      onClick={() => handleQueue(item.id, "reject")}
                      disabled={loading === item.id}
                      className="px-4 py-2 border border-white/[0.07] text-white/30 hover:text-white/55 text-xs rounded-xl hover:bg-white/[0.04] transition-colors disabled:opacity-40"
                    >Discard</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Activity ── */}
          {activeTab === "activity" && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-2xl">📋</div>
                  <p className="text-white/30 text-sm">No activity yet</p>
                </div>
              ) : activity.map((item, i) => {
                const plat = platformBadge(item.icon);
                return (
                  <div key={item.id} className={`flex items-center gap-4 px-5 py-3.5 ${i !== activity.length - 1 ? "border-b border-white/[0.05]" : ""} hover:bg-white/[0.02] transition-colors`}>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-base shrink-0">{item.icon ?? "·"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] text-white/75 font-medium truncate">{item.action}</p>
                        {plat === "li" && <span className="shrink-0 text-[9px] font-black bg-white/[0.07] text-white/30 px-1.5 py-0.5 rounded">in</span>}
                      </div>
                      {item.detail && <p className="text-xs text-white/30 truncate mt-0.5">{item.detail}</p>}
                    </div>
                    <time className="text-[11px] text-white/20 shrink-0 font-mono tabular-nums">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                    </time>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Schedule ── */}
          {activeTab === "schedule" && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
              {SCHEDULE.map((s, i) => (
                <div key={s.job} className={`flex items-center gap-4 px-5 py-4 ${i !== SCHEDULE.length - 1 ? "border-b border-white/[0.05]" : ""} hover:bg-white/[0.02] transition-colors`}>
                  <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-base shrink-0">{s.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] text-white/85">{s.job}</p>
                    <p className="text-xs text-white/35 mt-0.5">{s.times}</p>
                    <p className="text-[11px] text-white/20 mt-0.5">{s.note}</p>
                  </div>
                  <span className={`text-sm font-black shrink-0 tabular-nums ${s.red ? "text-red-400" : "text-white/40"}`}>{s.freq}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Settings ── */}
          {activeTab === "settings" && (() => {
            const allRequired  = SETUP_GROUPS.flatMap(g => g.keys.filter(k => k.required));
            const configured   = setupStatus ? allRequired.filter(k => setupStatus[k.key]) : [];
            const pct          = allRequired.length ? Math.round((configured.length / allRequired.length) * 100) : 0;
            const allGood      = configured.length === allRequired.length;

            return (
              <div className="space-y-3">

                {/* Progress */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">Environment Setup</p>
                    <p className="text-white/35 text-xs mt-0.5">{setupStatus ? (allGood ? "All required keys configured." : `${configured.length} / ${allRequired.length} required keys set`) : "Checking…"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-28 h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${allGood ? "bg-red-500" : "bg-red-600/60"}`} style={{ width:`${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-white/40 w-8 text-right tabular-nums">{setupStatus ? `${pct}%` : "…"}</span>
                  </div>
                </div>

                {/* LinkedIn connect */}
                <div className={`rounded-2xl border p-5 transition-colors ${
                  liConnected ? (liExpiringSoon ? "border-red-500/30 bg-red-500/5" : "border-white/[0.10] bg-white/[0.03]") : "border-white/[0.07] bg-[#111]"
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${liConnected ? "bg-white/[0.08] text-white/55" : "bg-white/[0.04] text-white/25"}`}>in</div>
                      <div>
                        <p className="text-sm font-bold">LinkedIn</p>
                        <p className={`text-xs mt-0.5 ${liConnected ? (liExpiringSoon ? "text-red-400" : "text-white/40") : "text-white/28"}`}>
                          {liConnected ? (liExpiringSoon ? "Token expiring soon — reconnect" : "Connected · posts running on schedule") : "Not connected — connect to enable Phase 2"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={openLiConnect}
                      className="text-xs font-bold px-4 py-2 rounded-xl transition-colors border border-white/[0.08] bg-white/[0.04] text-white/45 hover:text-white hover:bg-white/[0.08]"
                    >{liConnected ? "Reconnect" : "Connect"}</button>
                  </div>
                </div>

                {/* Env groups */}
                {SETUP_GROUPS.map(group => (
                  <div key={group.title} className="rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
                    <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
                      <h3 className="text-sm font-bold text-white/80">{group.title}</h3>
                      {group.href
                        ? <a href={group.href} target="_blank" rel="noreferrer" className="text-xs text-white/30 hover:text-white/60 transition-colors">{group.hintText} ↗</a>
                        : group.hintText && <span className="text-[11px] text-white/22">{group.hintText}</span>}
                    </div>
                    {group.guide && (
                      <div className="mx-5 mb-4 rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-widest font-black text-white/20 mb-2">How to set up</p>
                        {group.guide.map((step, si) => (
                          <div key={si} className="flex items-start gap-2.5">
                            <span className="shrink-0 text-[10px] font-black text-red-500/50 mt-0.5 w-4">{si + 1}.</span>
                            <p className="text-[12px] text-white/42 leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-white/[0.05]">
                      {group.keys.map(({ key, required, hint }, ki) => {
                        const isSet = setupStatus?.[key];
                        return (
                          <div key={key} className={`flex items-start gap-3 px-5 py-3.5 ${ki !== group.keys.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${isSet ? "bg-red-500/15 text-red-400" : required ? "bg-white/[0.06] text-white/25" : "bg-white/[0.04] text-white/15"}`}>
                              {isSet ? "✓" : required ? "✗" : "–"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <code className="text-xs text-white/65 font-mono">{key}</code>
                                {!required && <span className="text-[9px] text-white/15 uppercase tracking-wider">optional</span>}
                              </div>
                              {hint && <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">{hint}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Checklist */}
                <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
                  <h3 className="text-sm font-bold text-white/80 mb-4">Post-Setup Checklist</h3>
                  <div className="space-y-0">
                    {POST_SETUP_STEPS.map(({ step, desc }, i) => (
                      <div key={step} className={`flex items-start gap-3 py-3 ${i !== POST_SETUP_STEPS.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                        <span className="mt-0.5 text-red-500/40 text-xs shrink-0 font-black">→</span>
                        <div>
                          <code className="text-xs text-white/60 font-mono">{step}</code>
                          <p className="text-[11px] text-white/28 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Copy template */}
                <button
                  onClick={() => { navigator.clipboard.writeText(ENV_TEMPLATE); showToast(".env.local template copied"); }}
                  className="w-full py-3.5 border border-white/[0.07] hover:border-red-500/20 rounded-2xl text-sm font-medium text-white/35 hover:text-white/65 hover:bg-red-500/5 transition-all"
                >
                  Copy .env.local template
                </button>
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
