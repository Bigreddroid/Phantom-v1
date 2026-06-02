"use client";

import { useEffect, useState, useCallback } from "react";

type QueueItem = { id: string; type: string; content: string; status: string; createdAt: string };
type ActivityItem = { id: string; action: string; detail?: string; icon?: string; createdAt: string };
type Stats = { followers: number; following: number; tweets: number; engagements: number; dmsSent: number };

const SETUP_GROUPS = [
  {
    title: "X (Twitter) API",
    href: "https://developer.x.com",
    hintText: "Your app → Keys & Tokens",
    keys: [
      { key: "X_API_KEY",              label: "API Key",                  required: true  },
      { key: "X_API_SECRET",           label: "API Secret",               required: true  },
      { key: "X_BEARER_TOKEN",         label: "Bearer Token",             required: true  },
      { key: "X_ACCESS_TOKEN",         label: "Access Token",             required: true  },
      { key: "X_ACCESS_TOKEN_SECRET",  label: "Access Token Secret",      required: true  },
      { key: "X_CLIENT_ID",            label: "Client ID (OAuth 2.0)",    required: false },
      { key: "X_CLIENT_SECRET",        label: "Client Secret (OAuth 2.0)",required: false },
      { key: "X_USER_ID",              label: "Your numeric Twitter User ID", required: false, hint: "Your account's numeric ID — find it at tweeterid.com" },
    ],
  },
  {
    title: "AI",
    href: null as string | null,
    hintText: null as string | null,
    keys: [
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", required: true,  hint: "console.anthropic.com → API Keys" },
      { key: "GROK_API_KEY",      label: "xAI Grok API Key",  required: false, hint: "console.x.ai — falls back to Claude if not set" },
    ],
  },
  {
    title: "Telegram",
    href: null as string | null,
    hintText: null as string | null,
    keys: [
      { key: "TELEGRAM_BOT_TOKEN", label: "Bot Token",   required: true, hint: "@BotFather on Telegram → /newbot" },
      { key: "TELEGRAM_CHAT_ID",   label: "Your Chat ID", required: true, hint: "Message @userinfobot on Telegram to get your ID" },
    ],
  },
  {
    title: "Database",
    href: "https://supabase.com",
    hintText: "New project → Connect → ORM → Prisma",
    keys: [
      { key: "DATABASE_URL", label: "PostgreSQL connection string", required: true },
    ],
  },
  {
    title: "App Secrets",
    href: null as string | null,
    hintText: "Generate with: node -e \"require('crypto').randomBytes(32).toString('hex')\"",
    keys: [
      { key: "NEXTAUTH_SECRET", label: "NextAuth Secret",    required: true,  hint: "Random 32-byte hex string" },
      { key: "NEXTAUTH_URL",    label: "App URL",            required: true,  hint: "http://localhost:3000 locally · https://your-app.vercel.app on Vercel" },
      { key: "CRON_SECRET",     label: "Cron Secret",        required: true,  hint: "Random 32-byte hex string — also add to GitHub Actions secrets" },
    ],
  },
  {
    title: "Personalisation",
    href: null as string | null,
    hintText: "Optional — sensible defaults ship with the repo",
    keys: [
      { key: "X_HANDLE",           label: "X Handle",          required: false, hint: "e.g. @yourusername — shown in dashboard & OG images" },
      { key: "NEXT_PUBLIC_X_HANDLE",label: "X Handle (public)", required: false, hint: "Same value — needed for client-side rendering" },
      { key: "DISPLAY_INITIAL",    label: "Avatar Initial",     required: false, hint: "Single letter for the avatar circle in OG images" },
      { key: "NICHE_KEYWORDS",     label: "Niche Keywords",     required: false, hint: "Comma-separated search terms for engagement & follow loops" },
      { key: "CONTENT_TOPICS",     label: "Content Topics",     required: false, hint: "Comma-separated topics for tweet generation" },
      { key: "THREAD_TOPICS",      label: "Thread Topics",      required: false, hint: "Comma-separated angles for thread generation" },
      { key: "VOICE_TOPICS",       label: "Voice Topics",       required: false, hint: "Injected into the AI voice prompt" },
      { key: "BLOCKED_USERNAMES",  label: "Blocked Usernames",  required: false, hint: "Comma-separated — Phantom silently skips these accounts" },
      { key: "BLOCKED_IDS",        label: "Blocked User IDs",   required: false, hint: "Comma-separated numeric Twitter IDs to skip" },
    ],
  },
];

const POST_SETUP_STEPS = [
  { step: "npx prisma db push",       desc: "Push schema to your database" },
  { step: "npx prisma generate",      desc: "Generate the Prisma client" },
  { step: "/setup in your Telegram bot", desc: "Register webhook + command menu" },
  { step: "GitHub Actions → Settings → Secrets", desc: "Add APP_URL and CRON_SECRET" },
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

const JOBS = [
  { label: "Post Tweet", endpoint: "/api/jobs/tweet" },
  { label: "Post Thread", endpoint: "/api/jobs/thread" },
  { label: "Engage", endpoint: "/api/jobs/engage" },
  { label: "Check Mentions", endpoint: "/api/jobs/mentions" },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"queue" | "activity" | "schedule" | "settings">("queue");
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [setupStatus, setSetupStatus] = useState<Record<string, boolean> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    const [s, q, a] = await Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/queue").then((r) => r.json()),
      fetch("/api/activity").then((r) => r.json()),
    ]);
    setStats(s);
    setQueue(Array.isArray(q) ? q : []);
    setActivity(Array.isArray(a) ? a : []);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    fetch("/api/setup").then(r => r.json()).then(setSetupStatus).catch(() => {});
  }, []);

  const runJob = async (endpoint: string, label: string) => {
    setLoading(label);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.error) showToast(`❌ ${data.error}`);
      else showToast(`✅ ${label} triggered — check Telegram for approval`);
      await fetchAll();
    } catch {
      showToast("❌ Something went wrong");
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
    showToast(action === "approve" ? "✅ Posted to X" : "❌ Rejected");
    await fetchAll();
    setLoading(null);
  };

  const statCards = [
    { label: "Followers",   value: stats?.followers   ?? "—", color: "text-emerald-400", dot: "bg-emerald-400", glow: "shadow-emerald-500/10" },
    { label: "Tweets",      value: stats?.tweets      ?? "—", color: "text-sky-400",     dot: "bg-sky-400",     glow: "shadow-sky-500/10"     },
    { label: "Engagements", value: stats?.engagements ?? "—", color: "text-violet-400",  dot: "bg-violet-400",  glow: "shadow-violet-500/10"  },
    { label: "DMs Sent",    value: stats?.dmsSent     ?? "—", color: "text-amber-400",   dot: "bg-amber-400",   glow: "shadow-amber-500/10"   },
  ];

  const handle = process.env.NEXT_PUBLIC_X_HANDLE ?? "@yourusername";

  return (
    <div className="min-h-screen bg-[#07070f] text-white font-sans">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white text-black text-sm font-medium px-4 py-3 rounded-xl shadow-2xl shadow-black/40 flex items-center gap-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/[0.06] px-8 py-4 flex items-center justify-between backdrop-blur-sm sticky top-0 z-40 bg-[#07070f]/80">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[15px] tracking-tight">Phantom</span>
            <span className="text-xs text-white/25 font-mono">{handle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            refreshing
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? "bg-amber-400" : "bg-emerald-400"} animate-pulse`} />
            {refreshing ? "Syncing" : "Live"}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className={`bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 shadow-lg ${s.glow} hover:bg-white/[0.05] transition-colors`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <p className="text-white/40 text-[11px] uppercase tracking-widest">{s.label}</p>
              </div>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Run Jobs */}
        <div>
          <p className="text-white/25 text-[11px] uppercase tracking-widest mb-3 font-medium">Run now</p>
          <div className="flex flex-wrap gap-2">
            {JOBS.map((job) => (
              <button
                key={job.label}
                onClick={() => runJob(job.endpoint, job.label)}
                disabled={loading === job.label}
                className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] rounded-xl text-sm text-white/70 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              >
                {loading === job.label ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    Running…
                  </span>
                ) : job.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 w-fit">
            {(["queue", "activity", "schedule", "settings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-1.5 rounded-lg text-sm capitalize transition-all ${
                  activeTab === tab
                    ? "bg-white/10 text-white font-medium shadow-sm"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                {tab}
                {tab === "queue" && queue.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-indigo-500 text-white rounded-full px-1.5 py-0.5 font-semibold">{queue.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Queue */}
          {activeTab === "queue" && (
            <div className="space-y-2">
              {queue.length === 0 && (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4 text-xl">📭</div>
                  <p className="text-white/30 text-sm">Queue is empty</p>
                  <p className="text-white/15 text-xs mt-1">Run a job to generate content</p>
                </div>
              )}
              {queue.map((item) => (
                <div key={item.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 flex items-start justify-between gap-4 hover:bg-white/[0.05] transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-white/25 uppercase tracking-widest font-medium">{item.type}</span>
                    <p className="text-sm mt-1.5 text-white/75 whitespace-pre-line line-clamp-3 leading-relaxed">{item.content}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleQueue(item.id, "approve")}
                      disabled={loading === item.id}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs rounded-xl font-medium transition-colors disabled:opacity-40 shadow-sm shadow-emerald-500/20"
                    >
                      {loading === item.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleQueue(item.id, "reject")}
                      disabled={loading === item.id}
                      className="px-3 py-1.5 border border-white/[0.08] text-white/40 hover:text-white/70 text-xs rounded-xl hover:bg-white/[0.05] transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity */}
          {activeTab === "activity" && (
            <div>
              {activity.length === 0 && (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4 text-xl">📋</div>
                  <p className="text-white/30 text-sm">No activity yet</p>
                </div>
              )}
              {activity.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-3.5 border-b border-white/[0.05] last:border-0">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-base shrink-0">
                    {item.icon ?? "•"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80">{item.action}</p>
                    {item.detail && <p className="text-xs text-white/30 truncate mt-0.5">{item.detail}</p>}
                  </div>
                  <span className="text-xs text-white/20 shrink-0 font-mono">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Schedule */}
          {activeTab === "schedule" && (
            <div className="space-y-2">
              {[
                { job: "Tweets",        emoji: "🐦", times: "7:30am · 12:30pm · 6:30pm", freq: "3× / day",   note: "±15 min random offset · 15% skip",        color: "text-sky-400"     },
                { job: "Threads",       emoji: "🧵", times: "Mon & Thu · 2:30pm",         freq: "2× / week",  note: "20% skip chance",                          color: "text-violet-400"  },
                { job: "Engagement",    emoji: "⚡", times: "Every 30 min · 24/7",        freq: "48× / day",  note: "Like + reply · day mode full · night likes", color: "text-amber-400"   },
                { job: "Mentions",      emoji: "💬", times: "Every 30 minutes",            freq: "48× / day",  note: "Auto-replies instantly",                   color: "text-emerald-400" },
                { job: "Follow",        emoji: "🤝", times: "9:30am · 3:30pm · 8:30pm",   freq: "3× / day",   note: "Follow + like + reply to niche accounts",  color: "text-pink-400"    },
                { job: "Daily summary", emoji: "📊", times: "11:30pm IST",                 freq: "1× / day",   note: "Telegram report with stats",               color: "text-white/50"    },
              ].map((s) => (
                <div key={s.job} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 flex items-start justify-between gap-4 hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base shrink-0 mt-0.5">{s.emoji}</div>
                    <div>
                      <p className="font-medium text-white/90">{s.job}</p>
                      <p className="text-white/35 text-xs mt-0.5">{s.times}</p>
                      <p className="text-white/20 text-xs mt-0.5">{s.note}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium ${s.color}`}>{s.freq}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Settings */}
          {activeTab === "settings" && (() => {
            const allRequired = SETUP_GROUPS.flatMap(g => g.keys.filter(k => k.required));
            const configuredRequired = setupStatus ? allRequired.filter(k => setupStatus[k.key]) : [];
            const pct = allRequired.length ? Math.round((configuredRequired.length / allRequired.length) * 100) : 0;
            const allGood = configuredRequired.length === allRequired.length;

            return (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Environment Setup</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {setupStatus
                        ? allGood
                          ? "All required keys configured — Phantom is ready."
                          : `${configuredRequired.length} / ${allRequired.length} required keys configured`
                        : "Checking keys…"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${allGood ? "bg-green-400" : "bg-yellow-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/40 w-8 text-right">{setupStatus ? `${pct}%` : "…"}</span>
                  </div>
                </div>

                {/* Key groups */}
                {SETUP_GROUPS.map(group => (
                  <div key={group.title} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-sm font-medium">{group.title}</h3>
                      {group.href
                        ? <a href={group.href} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">{group.hintText} ↗</a>
                        : group.hintText && <span className="text-xs text-white/30 text-right max-w-xs">{group.hintText}</span>
                      }
                    </div>
                    <div className="space-y-0.5">
                      {group.keys.map(({ key, label, required, hint }) => {
                        const isSet = setupStatus?.[key];
                        return (
                          <div key={key} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isSet        ? "bg-green-500/15 text-green-400" :
                              required     ? "bg-red-500/15 text-red-400" :
                                             "bg-white/5 text-white/20"
                            }`}>
                              {isSet ? "✓" : required ? "✗" : "–"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-xs text-white/80 font-mono">{key}</code>
                                {!required && <span className="text-[10px] text-white/20 uppercase tracking-widest">optional</span>}
                              </div>
                              <p className="text-xs text-white/30 mt-0.5">{label}{hint ? ` — ${hint}` : ""}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Post-setup checklist */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-medium">Post-Setup Checklist</h3>
                  <div className="space-y-2">
                    {POST_SETUP_STEPS.map(({ step, desc }) => (
                      <div key={step} className="flex items-start gap-3 py-1">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-white/5 text-white/20 flex items-center justify-center text-[10px] shrink-0">→</span>
                        <div>
                          <code className="text-xs text-white/70 font-mono">{step}</code>
                          <p className="text-xs text-white/30 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Copy template */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(ENV_TEMPLATE);
                    showToast("✅ .env.local template copied to clipboard");
                  }}
                  className="w-full py-3 border border-white/10 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
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
