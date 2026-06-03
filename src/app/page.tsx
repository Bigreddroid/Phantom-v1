"use client";

const SCHEDULE = [
  { emoji: "🐦", job: "Tweets",        freq: "4×/day",   times: "7:30 · 12:30 · 18:30 · 21:30 IST", note: "AI-written, approval-gated" },
  { emoji: "🧵", job: "Threads",       freq: "2×/week",  times: "Mon & Thu · 14:30 IST",            note: "Long-form, approval-gated" },
  { emoji: "⚡", job: "Engagement",    freq: "96×/day",  times: "Every 15 min · 24/7",              note: "Likes + replies, traction ≥5" },
  { emoji: "🤝", job: "Follow",        freq: "1×/day",   times: "10:30 IST",                        note: "3 verified + 2 engaged accounts" },
  { emoji: "💬", job: "Mentions",      freq: "96×/day",  times: "Every 15 min",                     note: "Auto-replies to all @mentions" },
  { emoji: "💼", job: "LinkedIn",      freq: "4×/week",  times: "Tue–Fri · 8:30 IST",               note: "Original thought leadership" },
  { emoji: "🔁", job: "Resurface",     freq: "1×/day",   times: "10:30 IST",                        note: "Quote-tweet top old content" },
  { emoji: "🗣️", job: "Go-out",       freq: "5×/day",   times: "9 · 11 · 14 · 17 · 20 IST",        note: "Drop comments on viral threads" },
  { emoji: "📨", job: "Auto DM",       freq: "1×/day",   times: "13:30 IST",                        note: "Personalised, approval-gated" },
  { emoji: "📊", job: "Summary",       freq: "1×/day",   times: "23:30 IST",                        note: "Daily Telegram report" },
];

const FEATURES = [
  { icon: "𝕏",  title: "X/Twitter Automation",  desc: "Tweets, threads, likes, replies, follows, DMs — all on autopilot via cookie-based auth. No paid API required." },
  { icon: "💼", title: "LinkedIn Automation",    desc: "Thought leadership posts, personal stories, and numbered-list content 4×/week. OAuth-connected." },
  { icon: "🤖", title: "Telegram Command Center", desc: "Control everything from your phone. Post, reply, quote, search, like, pause, check stats — all via bot commands." },
  { icon: "🧠", title: "Claude AI Generation",   desc: "Every tweet, reply, thread and LinkedIn post is AI-generated in your voice using Anthropic Claude Sonnet/Haiku." },
  { icon: "📸", title: "Auto Image Cards",       desc: "30% of tweets attach a branded quote card — dark background, red accent, your handle. Generated at post time." },
  { icon: "🔔", title: "GitHub & Vercel Alerts", desc: "Push, star, fork, PR, deploy — every event pings your Telegram in real time with formatted notifications." },
  { icon: "🛡️", title: "Smart Deduplication",   desc: "7-day reply memory, 48-hour comment history, 30-day resurface tracking. Never double-posts or double-replies." },
  { icon: "⏱️", title: "Fully Scheduled",       desc: "cron-job.org fires every 15 min. IST-aligned schedule. One-click pause from Telegram or the dashboard." },
];

const STEPS = [
  { n: 1, title: "Fork & Deploy",         body: "Fork the GitHub repo, connect to Vercel, add your env vars. One-click deploy." },
  { n: 2, title: "Extract X Cookies",     body: "Run get-cookies.js with Brave/Chrome closed. Pushes X_COOKIES to Vercel automatically." },
  { n: 3, title: "Create Telegram Bot",   body: "@BotFather → /newbot → copy token. Run /setup in your bot to register webhook + commands." },
  { n: 4, title: "Connect LinkedIn",      body: "Open the dashboard Settings tab → Connect LinkedIn. One OAuth flow, token auto-refreshes." },
  { n: 5, title: "Set cron-job.org",      body: "Point cron-job.org at /api/cron/dispatch every 15 min. Add your CRON_SECRET header." },
  { n: 6, title: "Watch it run",          body: "Phantom posts, engages, and reports daily at 11:30pm IST. Approve tweets from Telegram." },
];

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.10] shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a] border-b border-white/[0.08]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto text-[11px] text-white/25 font-mono">phantom-beige.vercel.app/dashboard</span>
      </div>
      {children}
    </div>
  );
}

function DashboardMockup() {
  return (
    <BrowserFrame>
      <div className="bg-[#090909] text-white text-[11px] font-sans pointer-events-none select-none">
        {/* Red top bar */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-80" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-white/[0.06] bg-[#090909]/95">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-1">
                <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-[12px] tracking-tight">PHANTOM</div>
              <div className="text-[9px] text-white/30 font-mono">@BigRedDr0id</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-[9px] text-white/40">
              <span className="font-black text-white/60 text-[10px]">𝕏</span>
              <span className="w-1 h-1 rounded-full bg-red-500" />
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/8 border border-red-500/30 text-[9px] text-red-400 font-medium">
              <span className="w-1 h-1 rounded-full bg-red-500" />Live
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 px-5 pt-4 pb-3">
          {[
            { label: "Followers", value: "1.2k", red: true },
            { label: "Tweets",    value: "847",  red: false },
            { label: "Engagements", value: "23k", red: true },
            { label: "DMs Sent",  value: "156",  red: false },
            { label: "LI Posts",  value: "42",   red: false },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border bg-[#111] p-3 ${s.red ? "border-red-500/20" : "border-white/[0.07]"}`}>
              {s.red && <div className="absolute top-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-red-600/40 to-transparent" />}
              <div className="text-[8px] uppercase tracking-widest text-white/25 mb-1.5">{s.label}</div>
              <div className={`text-xl font-black tabular-nums ${s.red ? "text-red-400" : "text-white/70"}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mx-5 mb-3 rounded-xl border border-white/[0.07] bg-[#111] px-4 py-3">
          <div className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-2">𝕏 Actions</div>
          <div className="flex gap-2 flex-wrap">
            {["🐦 Queue Tweet","🧵 Queue Thread","⚡ Engage","💬 Check Mentions","🔁 Resurface"].map(j => (
              <div key={j} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-[9px] text-white/50">{j}</div>
            ))}
          </div>
        </div>

        {/* Tabs + Queue */}
        <div className="px-5 pb-4">
          <div className="flex gap-1 mb-3">
            {["queue","activity","schedule","settings"].map((t, i) => (
              <div key={t} className={`px-3 py-1.5 rounded-lg text-[9px] capitalize font-semibold ${i === 0 ? "bg-red-600 text-white" : "text-white/25"}`}>{t}{i===0 && <span className="ml-1 text-[8px] font-black bg-white text-red-600 rounded-full px-1">2</span>}</div>
            ))}
          </div>
          {/* Queue items */}
          {[
            "Building in public means embracing the mess. Every failed experiment is a data point. Every pivot is a lesson. Ship, learn, repeat. 🧵",
            "The best personal brands aren't built in a day. They're built at 7:30am, 12:30pm, 6:30pm and 9:30pm — one tweet at a time.",
          ].map((content, i) => (
            <div key={i} className="flex items-start gap-3 bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden mb-2">
              <div className="w-1 self-stretch bg-red-600 shrink-0" />
              <div className="flex-1 py-3 pr-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[8px] font-black uppercase text-red-400/80">Tweet</span>
                  <span className="text-[8px] text-white/20 font-mono">{i === 0 ? "7:30am" : "12:30pm"}</span>
                </div>
                <p className="text-[9px] text-white/60 leading-relaxed line-clamp-2">{content}</p>
              </div>
              <div className="flex flex-col gap-1 py-3 pr-3 shrink-0">
                <div className="px-3 py-1 bg-red-600 text-white text-[8px] rounded-lg font-bold">Post →</div>
                <div className="px-3 py-1 border border-white/[0.07] text-white/30 text-[8px] rounded-lg">Skip</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function TelegramMockup() {
  const msgs = [
    { from: "bot", text: "📊 *Daily Summary — Tue Jun 3*\n\n📈 +12 followers (1,247 total)\n🐦 4 tweets posted\n💬 38 replies sent\n❤️ 94 likes given\n📨 3 DMs sent" },
    { from: "bot", text: "🐦 *New tweet ready for approval*\n\nThe best founders I know have one thing in common: they treat distribution like a product feature, not an afterthought. Build the audience while you build the thing. 🧵", hasButtons: true },
    { from: "user", text: "Post →" },
    { from: "bot", text: "✅ Tweet posted!\nhttps://x.com/BigRedDr0id/status/..." },
  ];

  return (
    <BrowserFrame>
      <div className="bg-[#0e0e0e] min-h-[320px] p-4 space-y-3 pointer-events-none select-none">
        <div className="text-center text-[10px] text-white/20 mb-4 font-medium">@phantomioBot</div>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[10px] leading-relaxed whitespace-pre-line ${
              m.from === "bot"
                ? "bg-[#1e1e1e] border border-white/[0.08] text-white/75"
                : "bg-red-600 text-white font-medium"
            }`}>
              {m.text}
              {m.hasButtons && (
                <div className="flex gap-1.5 mt-2">
                  <div className="flex-1 text-center py-1 bg-red-600 rounded-lg text-[9px] font-bold text-white">✅ Post →</div>
                  <div className="flex-1 text-center py-1 bg-white/[0.08] rounded-lg text-[9px] text-white/50">✏️ Edit</div>
                  <div className="flex-1 text-center py-1 bg-white/[0.06] rounded-lg text-[9px] text-white/40">❌ Skip</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans antialiased overflow-x-hidden">

      {/* Red top accent */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent z-50 opacity-90" />

      {/* Background glows */}
      <div className="fixed top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-red-600/[0.04] blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full bg-red-600/[0.03] blur-3xl pointer-events-none" />

      {/* ── NAV ── */}
      <nav className="sticky top-[2px] z-40 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-600 to-red-900 shadow-lg shadow-red-900/40" />
              <svg className="absolute inset-0 w-full h-full p-1.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-[17px] tracking-tight">PHANTOM</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Bigreddroid/Phantom-v1"
              target="_blank" rel="noreferrer"
              className="hidden sm:flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              GitHub
            </a>
            <div className="flex flex-col items-center gap-0.5">
              <a
                href="/login"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-red-900/40"
              >
                Open Dashboard →
              </a>
              <span className="text-[10px] text-white/25 font-medium">Admin access only</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          AI Personal Brand · Running 24/7
        </div>

        <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-none mb-6">
          <span className="text-white">Your brand.</span>
          <br />
          <span className="bg-gradient-to-r from-red-500 via-red-400 to-red-600 bg-clip-text text-transparent">
            On autopilot.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed mb-10">
          Phantom posts tweets, engages your niche, replies to mentions, drops LinkedIn content,
          and sends you a daily report — all while you sleep. Controlled entirely from Telegram.
        </p>

        {/* Stats strip */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-12">
          {[
            { n: "96×", label: "engagements/day" },
            { n: "4×",  label: "tweets/day" },
            { n: "0",   label: "manual effort" },
            { n: "24/7", label: "always running" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-red-400 tabular-nums">{s.n}</div>
              <div className="text-xs text-white/30 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-base rounded-2xl transition-all shadow-xl shadow-red-900/30 hover:shadow-red-900/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            Open your dashboard
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </a>
          <p className="text-xs text-white/30 font-medium">Admin access only</p>
        </div>
      </section>

      {/* ── DASHBOARD PREVIEW ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest text-white/20 mb-3">What it looks like</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Command center + Telegram bot</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.10] flex items-center justify-center text-xs font-black text-white/40">𝕏</div>
              <p className="text-sm font-semibold text-white/60">Live dashboard</p>
            </div>
            <DashboardMockup />
            <p className="text-xs text-white/25 text-center">Real-time stats · content queue · one-click jobs</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.10] flex items-center justify-center text-xs">✈️</div>
              <p className="text-sm font-semibold text-white/60">Telegram control</p>
            </div>
            <TelegramMockup />
            <p className="text-xs text-white/25 text-center">Approve, edit, skip — from your phone</p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest text-white/20 mb-3">Everything included</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">One system. Full stack.</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="group rounded-2xl border border-white/[0.07] bg-[#111] p-5 hover:border-red-500/25 hover:bg-red-500/[0.02] transition-all">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-lg mb-4 group-hover:border-red-500/20 transition-colors">
                {f.icon}
              </div>
              <p className="font-bold text-sm text-white/85 mb-2">{f.title}</p>
              <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCHEDULE ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest text-white/20 mb-3">Built-in schedule</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Runs like clockwork</h2>
          <p className="text-white/35 mt-3 text-sm">All times IST. Randomised delays keep it human.</p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
          {SCHEDULE.map((s, i) => (
            <div key={s.job} className={`flex items-center gap-4 px-6 py-4 ${i !== SCHEDULE.length - 1 ? "border-b border-white/[0.05]" : ""} hover:bg-white/[0.02] transition-colors`}>
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg shrink-0">
                {s.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white/80">{s.job}</p>
                <p className="text-xs text-white/30 mt-0.5">{s.times}</p>
              </div>
              <div className="hidden sm:block text-xs text-white/25 text-right max-w-[200px]">{s.note}</div>
              <div className="text-sm font-black text-red-400 shrink-0 tabular-nums">{s.freq}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SETUP STEPS ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest text-white/20 mb-3">Get started</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Up in 15 minutes</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STEPS.map(s => (
            <div key={s.n} className="rounded-2xl border border-white/[0.07] bg-[#111] p-6 hover:border-white/[0.13] transition-colors relative overflow-hidden">
              <div className="absolute top-4 right-5 text-6xl font-black text-white/[0.03] leading-none select-none">{s.n}</div>
              <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center text-xs font-black text-red-400 mb-4">
                {s.n}
              </div>
              <p className="font-bold text-sm text-white/80 mb-2">{s.title}</p>
              <p className="text-xs text-white/35 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-6 pb-32 text-center">
        <div className="rounded-3xl border border-red-500/15 bg-gradient-to-b from-red-500/[0.06] to-transparent p-12 sm:p-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,38,38,0.08)_0%,transparent_60%)]" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-900/40">
              <svg className="w-8 h-8 p-1" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              Deploy your own Phantom
            </h2>
            <p className="text-white/40 text-base max-w-xl mx-auto mb-10 leading-relaxed">
              Fork the repo, set your env vars, and your personal brand runs itself from day one.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <a
                  href="/login"
                  className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-red-900/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Open Dashboard →
                </a>
                <span className="text-xs text-white/30 font-medium">Admin access only</span>
              </div>
              <a
                href="https://github.com/Bigreddroid/Phantom-v1"
                target="_blank" rel="noreferrer"
                className="px-8 py-4 border border-white/[0.10] hover:border-white/[0.20] bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white font-bold rounded-2xl transition-all"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-600 to-red-900">
              <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-1">
                <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-sm tracking-tight text-white/60">PHANTOM</span>
          </div>
          <p className="text-xs text-white/20">Part of <span className="text-white/40">BigRedDroid</span> · Built with Claude + Vercel</p>
          <div className="flex items-center gap-4 text-xs text-white/25">
            <a href="/login" className="hover:text-white/50 transition-colors">Dashboard</a>
            <a href="https://github.com/Bigreddroid/Phantom-v1" target="_blank" rel="noreferrer" className="hover:text-white/50 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
