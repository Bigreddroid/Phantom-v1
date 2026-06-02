"use client";

import { useEffect, useState, useCallback } from "react";

type QueueItem = { id: string; type: string; content: string; status: string; createdAt: string };
type ActivityItem = { id: string; action: string; detail?: string; icon?: string; createdAt: string };
type Stats = {
  followers: number;
  following: number;
  tweets: number;
  engagements: number;
  dmsSent: number;
  liPosts?: number;
  linkedInConnected?: boolean;
  linkedInExpiry?: string | null;
};

const SETUP_GROUPS = [
  {
    title: "X (Twitter) API",
    href: "https://developer.x.com",
    hintText: "developer.x.com",
    guide: [
      "Go to developer.x.com and sign in with your X account",
      "Create a new Project + App (Free tier is enough)",
      "In your app → Settings: set User authentication, enable Read + Write",
      "In Keys & Tokens: copy API Key, API Secret, Bearer Token",
      "Generate Access Token & Access Token Secret (must be after enabling Read+Write)",
    ],
    keys: [
      { key: "X_API_KEY",              label: "API Key",                  required: true,  hint: "App → Keys & Tokens → Consumer Keys" },
      { key: "X_API_SECRET",           label: "API Secret",               required: true,  hint: "App → Keys & Tokens → Consumer Keys" },
      { key: "X_BEARER_TOKEN",         label: "Bearer Token",             required: true,  hint: "App → Keys & Tokens → Bearer Token" },
      { key: "X_ACCESS_TOKEN",         label: "Access Token",             required: true,  hint: "Generate after enabling Read+Write permissions" },
      { key: "X_ACCESS_TOKEN_SECRET",  label: "Access Token Secret",      required: true,  hint: "Generated alongside Access Token — copy immediately, shown once" },
      { key: "X_CLIENT_ID",            label: "Client ID (OAuth 2.0)",    required: false, hint: "App → Keys & Tokens → OAuth 2.0 Client ID" },
      { key: "X_CLIENT_SECRET",        label: "Client Secret (OAuth 2.0)",required: false, hint: "Same section — optional unless you need OAuth 2.0 flows" },
      { key: "X_USER_ID",              label: "Numeric Twitter User ID",  required: false, hint: "Find yours at tweeterid.com — paste your handle" },
    ],
  },
  {
    title: "LinkedIn",
    href: "https://developer.linkedin.com",
    hintText: "developer.linkedin.com",
    guide: [
      "Go to developer.linkedin.com → My Apps → Create app",
      "Fill in app name, company page (create one if needed), and app logo",
      "In Products tab: request access to 'Share on LinkedIn' (instant approval)",
      "In Auth tab: copy Client ID and Client Secret 1",
      "Add your Vercel URL as an Authorized Redirect URL: https://your-app.vercel.app/api/auth/linkedin/callback",
      "After setting env vars and deploying, click Connect below to authorize",
    ],
    keys: [
      { key: "LINKEDIN_CLIENT_ID",     label: "Client ID",     required: false, hint: "App → Auth tab → Application credentials" },
      { key: "LINKEDIN_CLIENT_SECRET", label: "Client Secret", required: false, hint: "Same page — Client Secret 1 (rotate every 12 months)" },
    ],
  },
  {
    title: "AI",
    href: null as string | null,
    hintText: null as string | null,
    guide: [
      "Anthropic (required): console.anthropic.com → Settings → API Keys → Create Key",
      "Grok (optional): console.x.ai → API Keys → Create. Uses grok-3, falls back to Claude if not set",
    ],
    keys: [
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", required: true,  hint: "console.anthropic.com → API Keys. Claude Sonnet is the default model." },
      { key: "GROK_API_KEY",      label: "xAI Grok API Key",  required: false, hint: "console.x.ai — when set, Grok handles all X content generation (better for tweets)" },
    ],
  },
  {
    title: "Telegram Bot",
    href: null as string | null,
    hintText: null as string | null,
    guide: [
      "Open Telegram and message @BotFather → /newbot → follow prompts",
      "BotFather gives you a bot token — copy it",
      "Start a conversation with your new bot",
      "Message @userinfobot — it replies with your numeric Chat ID",
      "After setting env vars, send /setup to your bot to register the webhook",
    ],
    keys: [
      { key: "TELEGRAM_BOT_TOKEN", label: "Bot Token",    required: true, hint: "@BotFather → /newbot → token (format: 123456:ABC-DEF...)" },
      { key: "TELEGRAM_CHAT_ID",   label: "Your Chat ID", required: true, hint: "Message @userinfobot — returns your numeric ID (not your username)" },
    ],
  },
  {
    title: "Database",
    href: "https://supabase.com",
    hintText: "supabase.com",
    guide: [
      "Go to supabase.com → New project (free tier works)",
      "Once created: Settings → Database → Connection string → URI",
      "Copy the connection string — replace [YOUR-PASSWORD] with your project password",
      "After setting DATABASE_URL, run: npx prisma db push",
    ],
    keys: [
      { key: "DATABASE_URL", label: "PostgreSQL connection string", required: true, hint: "Supabase: Settings → Database → URI. Format: postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres" },
    ],
  },
  {
    title: "App Secrets",
    href: null as string | null,
    hintText: null as string | null,
    guide: [
      `Generate secrets: node -e "require('crypto').randomBytes(32).toString('hex')"`,
      "NEXTAUTH_URL: http://localhost:3000 locally, https://your-app.vercel.app in production",
      "CRON_SECRET: also add this to GitHub → Settings → Secrets → Actions as CRON_SECRET",
      "APP_URL also goes to GitHub secrets (same value as NEXTAUTH_URL)",
    ],
    keys: [
      { key: "NEXTAUTH_SECRET", label: "NextAuth Secret",  required: true,  hint: "Any random 32-byte hex string — used to sign session tokens" },
      { key: "NEXTAUTH_URL",    label: "App URL",          required: true,  hint: "IMPORTANT: must be your production URL on Vercel, not localhost" },
      { key: "CRON_SECRET",     label: "Cron Secret",      required: true,  hint: "Bearer token for GitHub Actions → add to repo Secrets as CRON_SECRET" },
    ],
  },
  {
    title: "Personalisation",
    href: null as string | null,
    hintText: "All optional — sensible defaults are built in",
    guide: [
      "X_HANDLE and NEXT_PUBLIC_X_HANDLE: your @username (same value, both needed)",
      "NICHE_KEYWORDS: comma-separated search terms for the engagement + follow loops",
      "CONTENT_TOPICS: topics Phantom generates tweets about (comma-separated full sentences)",
      "VOICE_TOPICS: short list injected into the AI prompt to shape your content voice",
    ],
    keys: [
      { key: "X_HANDLE",            label: "X Handle",          required: false, hint: "e.g. @yourusername — shown in header and OG images" },
      { key: "NEXT_PUBLIC_X_HANDLE",label: "X Handle (public)", required: false, hint: "Same as X_HANDLE — needed because Next.js requires public prefix for client-side" },
      { key: "DISPLAY_INITIAL",     label: "Avatar Initial",     required: false, hint: "Single letter (e.g. V) for the avatar circle in OG images" },
      { key: "NICHE_KEYWORDS",      label: "Niche Keywords",     required: false, hint: "e.g. founder personal brand,solopreneur automation,building in public" },
      { key: "CONTENT_TOPICS",      label: "Content Topics",     required: false, hint: "Full sentences work best: e.g. lessons from building in public" },
      { key: "THREAD_TOPICS",       label: "Thread Topics",      required: false, hint: "Angles for thread generation — full sentences, one per topic" },
      { key: "VOICE_TOPICS",        label: "Voice Topics",       required: false, hint: "Short comma list injected into AI prompt: e.g. personal branding, AI automation" },
      { key: "BLOCKED_USERNAMES",   label: "Blocked Usernames",  required: false, hint: "Comma-separated usernames — Phantom silently skips these accounts" },
      { key: "BLOCKED_IDS",         label: "Blocked User IDs",   required: false, hint: "Numeric Twitter IDs to skip — more reliable than usernames" },
    ],
  },
];

const POST_SETUP_STEPS = [
  { step: "npx prisma db push",               desc: "Push schema to your database" },
  { step: "npx prisma generate",              desc: "Generate the Prisma client" },
  { step: "/setup in your Telegram bot",      desc: "Register webhook + command menu" },
  { step: "GitHub Actions → Secrets",         desc: "Add APP_URL and CRON_SECRET" },
  { step: "/linkedin → Connect account",      desc: "Authorize LinkedIn once to enable Phase 2" },
];

const ENV_TEMPLATE = `# X (Twitter) API — developer.x.com → Your app → Keys & Tokens
X_API_KEY=
X_API_SECRET=
X_BEARER_TOKEN=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=
X_USER_ID=

# LinkedIn (Phase 2) — developer.linkedin.com
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# AI — console.anthropic.com / console.x.ai
ANTHROPIC_API_KEY=
GROK_API_KEY=

# Telegram — @BotFather for token, @userinfobot for chat ID
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Database — supabase.com → Connect → ORM → Prisma
DATABASE_URL=

# App secrets — generate: node -e "require('crypto').randomBytes(32).toString('hex')"
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
CRON_SECRET=

# Personalisation (optional — defaults ship with the repo)
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

// Determine platform from activity icon
function platformBadge(icon?: string) {
  const liIcons = ["💼", "🔗"];
  if (!icon) return null;
  if (liIcons.includes(icon)) return "li";
  return "x";
}

const X_JOBS = [
  { label: "Tweet",          endpoint: "/api/jobs/tweet",    icon: "🐦" },
  { label: "Thread",         endpoint: "/api/jobs/thread",   icon: "🧵" },
  { label: "Engage",         endpoint: "/api/jobs/engage",   icon: "⚡" },
  { label: "Check Mentions", endpoint: "/api/jobs/mentions", icon: "💬" },
];

const LI_JOBS = [
  { label: "Post",         endpoint: "/api/jobs/linkedin",       icon: "💼", desc: "Thought leadership"  },
  { label: "Story",        endpoint: "/api/jobs/linkedin-story", icon: "📖", desc: "Personal narrative"   },
  { label: "5 Lessons",    endpoint: "/api/jobs/linkedin-list",  icon: "📋", desc: "Numbered list post"   },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"queue" | "activity" | "schedule" | "settings">("queue");
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [setupStatus, setSetupStatus] = useState<Record<string, boolean> | null>(null);
  const [liSetupModal, setLiSetupModal] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    const [s, q, a] = await Promise.all([
      fetch("/api/stats").then((r) => r.json()).catch(() => null),
      fetch("/api/queue").then((r) => r.json()).catch(() => []),
      fetch("/api/activity").then((r) => r.json()).catch(() => []),
    ]);
    if (s && !s.error) setStats(s);
    setQueue(Array.isArray(q) ? q : []);
    setActivity(Array.isArray(a) ? a : []);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    fetch("/api/setup").then(r => r.json()).then(setSetupStatus).catch(() => {});
  }, []);

  // Handle LinkedIn OAuth redirect params
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const li = p.get("li");
    if (li === "connected")     { showToast("LinkedIn connected"); setActiveTab("settings"); }
    else if (li === "needs_setup") setLiSetupModal(true);
    else if (li === "denied")   showToast("LinkedIn authorization denied", "err");
    else if (li === "token_error" || li === "profile_error" || li === "invalid") showToast("LinkedIn auth failed — try again", "err");
    if (li) window.history.replaceState({}, "", "/");
  }, []);

  const runJob = async (endpoint: string, label: string) => {
    setLoading(label);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.error) showToast(`${data.error}`, "err");
      else showToast(`${label} triggered`);
      await fetchAll();
    } catch {
      showToast("Something went wrong", "err");
    }
    setLoading(null);
  };

  const handleQueue = async (id: string, action: "approve" | "reject") => {
    setLoading(id);
    await fetch("/api/queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    showToast(action === "approve" ? "Posted to X" : "Rejected");
    await fetchAll();
    setLoading(null);
  };

  const handle = process.env.NEXT_PUBLIC_X_HANDLE ?? "@yourusername";
  const liConnected = stats?.linkedInConnected ?? false;
  const liExpiringSoon = stats?.linkedInExpiry
    ? (new Date(stats.linkedInExpiry).getTime() - Date.now()) < 7 * 86400000
    : false;

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-[#06060e] text-white font-sans antialiased">

      {/* LinkedIn Setup Modal */}
      {liSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0d0d18] border border-white/[0.09] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">in</div>
                <div>
                  <p className="font-semibold text-sm">Connect LinkedIn</p>
                  <p className="text-xs text-white/35 mt-0.5">One-time setup · 5 minutes</p>
                </div>
              </div>
              <button onClick={() => setLiSetupModal(false)} className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-white/40 hover:text-white/70 flex items-center justify-center text-lg leading-none transition-colors">×</button>
            </div>

            {/* Steps */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-white/35">Follow these steps, then come back and click <span className="text-white/60 font-medium">Try Again</span> below.</p>

              {[
                {
                  n: 1,
                  title: "Create a LinkedIn App",
                  body: "Go to developer.linkedin.com → My Apps → Create app. Fill in app name, attach a company page (create one if needed), and upload a logo.",
                  link: { label: "Open LinkedIn Developer Portal →", href: "https://developer.linkedin.com/apps" },
                },
                {
                  n: 2,
                  title: "Enable 'Share on LinkedIn' product",
                  body: "In your app → Products tab → find 'Share on LinkedIn' → click Request access. Approval is instant.",
                },
                {
                  n: 3,
                  title: "Copy your credentials",
                  body: "In your app → Auth tab → copy Client ID and Client Secret 1. These go into Vercel as env vars.",
                },
                {
                  n: 4,
                  title: "Add the redirect URL",
                  body: `In Auth tab → Authorized Redirect URLs → add exactly:`,
                  code: `${appUrl}/api/auth/linkedin/callback`,
                },
                {
                  n: 5,
                  title: "Add env vars to Vercel",
                  body: "Go to your Vercel project → Settings → Environment Variables and add both keys.",
                  link: { label: "Open Vercel Dashboard →", href: "https://vercel.com/dashboard" },
                  code2: "LINKEDIN_CLIENT_ID\nLINKEDIN_CLIENT_SECRET",
                },
                {
                  n: 6,
                  title: "Redeploy Vercel",
                  body: "After adding env vars, trigger a redeploy so Vercel picks them up. Then come back and click Try Again.",
                },
              ].map((s) => (
                <div key={s.n} className="flex gap-3.5">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[11px] font-bold flex items-center justify-center mt-0.5">{s.n}</span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium text-white/80">{s.title}</p>
                    <p className="text-xs text-white/40 leading-relaxed">{s.body}</p>
                    {s.code && (
                      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2">
                        <code className="text-xs text-blue-300/80 font-mono flex-1 break-all">{s.code}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(s.code!); showToast("Copied"); }}
                          className="shrink-0 text-[10px] text-white/30 hover:text-white/60 border border-white/[0.08] rounded-md px-2 py-0.5 transition-colors"
                        >copy</button>
                      </div>
                    )}
                    {s.code2 && (
                      <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 space-y-1">
                        {s.code2.split("\n").map(k => (
                          <code key={k} className="block text-xs text-white/50 font-mono">{k}</code>
                        ))}
                      </div>
                    )}
                    {s.link && (
                      <a href={s.link.href} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-blue-400/70 hover:text-blue-400 transition-colors">
                        {s.link.label}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.07] bg-white/[0.015]">
              <button
                onClick={() => setLiSetupModal(false)}
                className="text-sm text-white/30 hover:text-white/55 transition-colors"
              >
                Do this later
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setLiSetupModal(false); setActiveTab("settings"); }}
                  className="px-4 py-2 text-sm border border-white/[0.08] rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
                >
                  View Settings
                </button>
                <a
                  href="/api/auth/linkedin"
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-sm shadow-blue-500/20"
                >
                  Try Again →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border transition-all ${
          toast.type === "err"
            ? "bg-red-950 border-red-800/60 text-red-300"
            : "bg-[#0f1117] border-white/10 text-white"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toast.type === "err" ? "bg-red-400" : "bg-emerald-400"}`} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[#06060e]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 shrink-0">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 opacity-90" />
              <svg className="absolute inset-0 w-full h-full p-1.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="1.8" fill="white"/>
              </svg>
            </div>
            <div>
              <span className="font-semibold text-[15px] tracking-tight leading-none">Phantom</span>
              <span className="ml-2 text-xs text-white/25 font-mono">{handle}</span>
            </div>
          </div>

          {/* Platform status pills */}
          <div className="flex items-center gap-2">
            {/* X status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-white/50">
              <span className="font-bold text-white/70">𝕏</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            {/* LinkedIn status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
              liConnected
                ? liExpiringSoon
                  ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                  : "bg-blue-500/10 border-blue-500/25 text-blue-400"
                : "bg-white/[0.03] border-white/[0.06] text-white/25"
            }`}>
              <span className="font-bold text-[11px]">in</span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                liConnected
                  ? liExpiringSoon ? "bg-amber-400" : "bg-blue-400"
                  : "bg-white/20"
              }`} />
            </div>

            {/* Live / Syncing */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
              refreshing
                ? "border-amber-500/25 bg-amber-500/8 text-amber-400"
                : "border-emerald-500/25 bg-emerald-500/8 text-emerald-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
              {refreshing ? "Syncing" : "Live"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-7">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {[
            { label: "Followers",  value: stats?.followers   ?? "—", sub: "X",       color: "text-emerald-400", accent: "from-emerald-500/10"  },
            { label: "Tweets",     value: stats?.tweets      ?? "—", sub: "X",       color: "text-sky-400",     accent: "from-sky-500/10"      },
            { label: "Engagements",value: stats?.engagements ?? "—", sub: "X",       color: "text-violet-400",  accent: "from-violet-500/10"   },
            { label: "DMs Sent",   value: stats?.dmsSent     ?? "—", sub: "X",       color: "text-amber-400",   accent: "from-amber-500/10"    },
            { label: "LI Posts",   value: stats?.liPosts     ?? "—", sub: "LinkedIn",color: "text-blue-400",    accent: "from-blue-500/10"     },
          ].map((s) => (
            <div
              key={s.label}
              className={`relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b ${s.accent} to-transparent p-4 hover:border-white/[0.12] transition-colors`}
            >
              <p className="text-[10px] uppercase tracking-widest font-medium text-white/30 mb-2.5">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <span className={`absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                s.sub === "LinkedIn"
                  ? "bg-blue-500/15 text-blue-400/70"
                  : "bg-white/5 text-white/20"
              }`}>{s.sub === "LinkedIn" ? "in" : "𝕏"}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          {/* X jobs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold bg-white/8 px-2 py-0.5 rounded-md text-white/50">𝕏</span>
              <span className="text-[10px] uppercase tracking-widest font-medium text-white/25">X Actions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {X_JOBS.map((job) => (
                <button
                  key={job.label}
                  onClick={() => runJob(job.endpoint, job.label)}
                  disabled={!!loading}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.14] rounded-xl text-sm text-white/60 hover:text-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                >
                  {loading === job.label ? (
                    <>
                      <span className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
                      <span className="text-white/40">Running…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base leading-none">{job.icon}</span>
                      {job.label}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* LinkedIn jobs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold bg-blue-500/15 px-2 py-0.5 rounded-md text-blue-400/70">in</span>
              <span className="text-[10px] uppercase tracking-widest font-medium text-white/25">LinkedIn</span>
              {!liConnected && (
                <button
                  onClick={() => {
                    const hasClientId = setupStatus?.["LINKEDIN_CLIENT_ID"];
                    if (!hasClientId) { setLiSetupModal(true); }
                    else { window.location.href = "/api/auth/linkedin"; }
                  }}
                  className="ml-auto text-[10px] text-blue-400/70 hover:text-blue-400 border border-blue-500/20 bg-blue-500/8 px-2 py-0.5 rounded-md transition-colors"
                >
                  Connect →
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {LI_JOBS.map((job) => (
                <button
                  key={job.label}
                  onClick={() => {
                    if (!liConnected) { showToast("Connect LinkedIn first — click Connect above", "err"); return; }
                    runJob(job.endpoint, job.label);
                  }}
                  disabled={!!loading}
                  className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 ${
                    liConnected
                      ? "bg-blue-500/8 hover:bg-blue-500/15 border-blue-500/20 hover:border-blue-500/35 text-blue-400/70 hover:text-blue-400"
                      : "bg-white/[0.03] border-white/[0.06] text-white/25 cursor-not-allowed"
                  }`}
                >
                  {loading === job.label ? (
                    <>
                      <span className="w-3 h-3 border border-blue-400/30 border-t-blue-400/80 rounded-full animate-spin" />
                      <span className="text-blue-400/40">Running…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base leading-none">{job.icon}</span>
                      <span>
                        {job.label}
                        {"desc" in job && job.desc && (
                          <span className="block text-[10px] opacity-50 font-normal leading-none mt-0.5">{job.desc}</span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-0.5 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
            {(["queue", "activity", "schedule", "settings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-1.5 rounded-lg text-sm capitalize font-medium transition-all ${
                  activeTab === tab
                    ? "bg-white/[0.09] text-white shadow-sm"
                    : "text-white/30 hover:text-white/55 hover:bg-white/[0.03]"
                }`}
              >
                {tab}
                {tab === "queue" && queue.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-indigo-500 text-white rounded-full">{queue.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Queue ── */}
          {activeTab === "queue" && (
            <div className="space-y-2">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg">📭</div>
                  <div>
                    <p className="text-white/30 text-sm">Queue is empty</p>
                    <p className="text-white/15 text-xs mt-0.5">Trigger a job above to generate content</p>
                  </div>
                </div>
              ) : queue.map((item) => (
                <div key={item.id} className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-4 flex items-start justify-between gap-4 hover:bg-white/[0.04] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">{item.type}</span>
                      <span className="text-[9px] text-white/15 font-mono">{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-sm text-white/70 whitespace-pre-line line-clamp-3 leading-relaxed">{item.content}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 pt-5">
                    <button
                      onClick={() => handleQueue(item.id, "approve")}
                      disabled={loading === item.id}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs rounded-lg font-semibold transition-colors disabled:opacity-40 shadow-sm shadow-emerald-500/25"
                    >
                      {loading === item.id ? "…" : "Post"}
                    </button>
                    <button
                      onClick={() => handleQueue(item.id, "reject")}
                      disabled={loading === item.id}
                      className="px-3 py-1.5 border border-white/[0.08] text-white/35 hover:text-white/60 text-xs rounded-lg hover:bg-white/[0.04] transition-colors disabled:opacity-40"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Activity ── */}
          {activeTab === "activity" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg">📋</div>
                  <p className="text-white/30 text-sm">No activity yet</p>
                </div>
              ) : activity.map((item, i) => {
                const plat = platformBadge(item.icon);
                return (
                  <div key={item.id} className={`flex items-center gap-3.5 px-5 py-3.5 ${i !== activity.length - 1 ? "border-b border-white/[0.05]" : ""} hover:bg-white/[0.025] transition-colors`}>
                    <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-sm shrink-0">
                      {item.icon ?? "•"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white/75 truncate">{item.action}</p>
                        {plat === "li" && (
                          <span className="shrink-0 text-[9px] font-bold bg-blue-500/15 text-blue-400/70 px-1.5 py-0.5 rounded-md">in</span>
                        )}
                      </div>
                      {item.detail && <p className="text-xs text-white/28 truncate mt-0.5">{item.detail}</p>}
                    </div>
                    <time className="text-[11px] text-white/20 shrink-0 font-mono tabular-nums">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Schedule ── */}
          {activeTab === "schedule" && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              {[
                { job: "Tweets",         emoji: "🐦", times: "7:30am · 12:30pm · 6:30pm · 9:30pm",  freq: "4× / day",   note: "±15 min offset · 15% skip",                     color: "text-sky-400",     platform: "x"  },
                { job: "Threads",        emoji: "🧵", times: "Mon & Thu · 2:30pm IST",               freq: "2× / week",  note: "5 tweets · 20% skip chance",                   color: "text-violet-400",  platform: "x"  },
                { job: "Engagement",     emoji: "⚡", times: "Every 30 min · 24/7",                  freq: "48× / day",  note: "Like + reply · 10:1 verified ratio",            color: "text-amber-400",   platform: "x"  },
                { job: "Follow",         emoji: "🤝", times: "9:30am · 3:30pm · 8:30pm IST",         freq: "3× / day",   note: "Follow + like + reply to niche accounts",       color: "text-pink-400",    platform: "x"  },
                { job: "Mentions",       emoji: "💬", times: "Every 30 minutes",                     freq: "48× / day",  note: "Auto-replies instantly",                        color: "text-emerald-400", platform: "x"  },
                { job: "LinkedIn",       emoji: "💼", times: "Tue–Fri · 8:30am IST",                 freq: "4× / week",  note: "Original post · 10% skip",                      color: "text-blue-400",    platform: "li" },
                { job: "Daily summary",  emoji: "📊", times: "11:30pm IST",                          freq: "1× / day",   note: "Telegram report with follower gain",            color: "text-white/35",    platform: "x"  },
              ].map((s, i, arr) => (
                <div key={s.job} className={`flex items-center gap-4 px-5 py-4 ${i !== arr.length - 1 ? "border-b border-white/[0.05]" : ""} hover:bg-white/[0.02] transition-colors`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                    s.platform === "li" ? "bg-blue-500/10" : "bg-white/[0.05]"
                  }`}>{s.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-white/85">{s.job}</p>
                      {s.platform === "li" && (
                        <span className="text-[9px] font-bold bg-blue-500/15 text-blue-400/70 px-1.5 py-0.5 rounded-md">in</span>
                      )}
                    </div>
                    <p className="text-xs text-white/30 mt-0.5">{s.times}</p>
                    <p className="text-[11px] text-white/18 mt-0.5">{s.note}</p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 tabular-nums ${s.color}`}>{s.freq}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Settings ── */}
          {activeTab === "settings" && (() => {
            const allRequired = SETUP_GROUPS.flatMap(g => g.keys.filter(k => k.required));
            const configured = setupStatus ? allRequired.filter(k => setupStatus[k.key]) : [];
            const pct = allRequired.length ? Math.round((configured.length / allRequired.length) * 100) : 0;
            const allGood = configured.length === allRequired.length;

            return (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Environment Setup</p>
                    <p className="text-white/35 text-xs mt-0.5">
                      {setupStatus
                        ? allGood
                          ? "All required keys configured."
                          : `${configured.length} / ${allRequired.length} required keys set`
                        : "Checking…"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${allGood ? "bg-emerald-400" : "bg-amber-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/35 w-8 text-right tabular-nums">{setupStatus ? `${pct}%` : "…"}</span>
                  </div>
                </div>

                {/* LinkedIn connect card */}
                <div className={`rounded-2xl border p-5 transition-colors ${
                  liConnected
                    ? liExpiringSoon
                      ? "border-amber-500/25 bg-amber-500/5"
                      : "border-blue-500/20 bg-blue-500/5"
                    : "border-white/[0.07] bg-white/[0.025]"
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                        liConnected ? "bg-blue-500/20 text-blue-400" : "bg-white/[0.05] text-white/30"
                      }`}>in</div>
                      <div>
                        <p className="text-sm font-semibold">LinkedIn</p>
                        <p className={`text-xs mt-0.5 ${
                          liConnected
                            ? liExpiringSoon ? "text-amber-400" : "text-blue-400/70"
                            : "text-white/30"
                        }`}>
                          {liConnected
                            ? liExpiringSoon
                              ? "Token expiring soon — reconnect"
                              : "Connected · posts running on schedule"
                            : "Not connected — connect to enable Phase 2"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const hasClientId = setupStatus?.["LINKEDIN_CLIENT_ID"];
                        if (!hasClientId) { setLiSetupModal(true); }
                        else { window.location.href = "/api/auth/linkedin"; }
                      }}
                      className={`text-xs font-medium px-4 py-2 rounded-xl transition-colors border ${
                        liConnected
                          ? "border-blue-500/25 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          : "border-white/[0.08] bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08]"
                      }`}
                    >
                      {liConnected ? "Reconnect" : "Connect"}
                    </button>
                  </div>
                </div>

                {/* Env key groups */}
                {SETUP_GROUPS.map(group => (
                  <div key={group.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
                      <h3 className="text-sm font-semibold text-white/80">{group.title}</h3>
                      {group.href
                        ? <a href={group.href} target="_blank" rel="noreferrer" className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors">{group.hintText} ↗</a>
                        : group.hintText && <span className="text-[11px] text-white/25 text-right max-w-xs">{group.hintText}</span>
                      }
                    </div>

                    {/* Setup guide */}
                    {group.guide && (
                      <div className="mx-5 mb-4 rounded-xl bg-white/[0.03] border border-white/[0.05] p-3.5 space-y-1.5">
                        <p className="text-[10px] uppercase tracking-widest font-semibold text-white/25 mb-2">How to set up</p>
                        {group.guide.map((step, si) => (
                          <div key={si} className="flex items-start gap-2.5">
                            <span className="shrink-0 text-[10px] font-bold text-white/20 mt-0.5 w-3.5">{si + 1}.</span>
                            <p className="text-[12px] text-white/45 leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Keys */}
                    <div className="border-t border-white/[0.05]">
                      {group.keys.map(({ key, label, required, hint }, ki) => {
                        const isSet = setupStatus?.[key];
                        return (
                          <div key={key} className={`flex items-start gap-3 px-5 py-3 ${ki !== group.keys.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                              isSet        ? "bg-emerald-500/15 text-emerald-400" :
                              required     ? "bg-red-500/12 text-red-400" :
                                             "bg-white/5 text-white/20"
                            }`}>
                              {isSet ? "✓" : required ? "✗" : "–"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-xs text-white/70 font-mono">{key}</code>
                                {!required && <span className="text-[9px] text-white/18 uppercase tracking-wider">optional</span>}
                              </div>
                              {hint && (
                                <p className="text-[11px] text-white/32 mt-0.5 leading-relaxed">{hint}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Post-setup checklist */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-white/80">Post-Setup Checklist</h3>
                  <div>
                    {POST_SETUP_STEPS.map(({ step, desc }, i) => (
                      <div key={step} className={`flex items-start gap-3 py-2.5 ${i !== POST_SETUP_STEPS.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                        <span className="mt-0.5 text-white/20 text-xs shrink-0">→</span>
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
                  onClick={() => {
                    navigator.clipboard.writeText(ENV_TEMPLATE);
                    showToast(".env.local template copied");
                  }}
                  className="w-full py-3 border border-white/[0.07] rounded-2xl text-sm text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
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
