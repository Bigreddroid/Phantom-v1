"use client";

import { useState } from "react";

const SCHEDULE = [
  { emoji: "🐦", job: "Tweets",        freq: "4×/day",   times: "7:28 · 12:28 · 18:28 · 21:28 IST", note: "AI-written, approval-gated" },
  { emoji: "📝", job: "Long-form",     freq: "1×/day",   times: "10:28 IST",                         note: "Premium+ mini-essays, 600–1800 chars" },
  { emoji: "📰", job: "Articles",      freq: "2×/week",  times: "Wed & Sat · 9:28 IST",              note: "6-tweet educational thread + cover image" },
  { emoji: "🧵", job: "Threads",       freq: "2×/week",  times: "Mon & Thu · 14:28 IST",             note: "Long-form, approval-gated" },
  { emoji: "⚡", job: "Engagement",    freq: "96×/day",  times: "Every 15 min · 24/7",               note: "Likes + replies, traction ≥5" },
  { emoji: "🤝", job: "Follow",        freq: "8–9×/day", times: "Throughout the day",                note: "Verified + engaged accounts in niche" },
  { emoji: "💬", job: "Mentions",      freq: "96×/day",  times: "Every 15 min",                      note: "Auto-replies within ~15 min, never repeats" },
  { emoji: "🗣️", job: "Go-out",       freq: "8–9×/day", times: "Throughout the day",                note: "Drop comments on high-traction threads" },
  { emoji: "💼", job: "LinkedIn",      freq: "4×/week",  times: "Tue–Fri · 8:28 IST",               note: "Thought leadership, stories, lists" },
  { emoji: "🔁", job: "Resurface",     freq: "1×/day",   times: "10:28 IST",                        note: "Quote-tweet top old content" },
  { emoji: "📨", job: "Auto DM",       freq: "8–9×/day", times: "Throughout the day",               note: "Feedback-ask DMs, approval-gated" },
  { emoji: "📊", job: "Summary",       freq: "1×/day",   times: "23:28 IST",                        note: "Daily Telegram report" },
];

const FEATURES = [
  { icon: "𝕏",  title: "X/Twitter Automation",    desc: "Tweets, threads, likes, replies, follows, DMs — all on autopilot via cookie-based auth. No paid API required." },
  { icon: "📝", title: "Long-form Posts",           desc: "Premium+ 600–1800 char mini-essays every morning. Hooks, paragraphs, zero hashtags. Looks human, isn't." },
  { icon: "💼", title: "LinkedIn Automation",       desc: "Thought leadership, personal stories, and numbered-list content 4×/week. OAuth-connected, auto-refreshes." },
  { icon: "🤖", title: "Telegram Command Center",  desc: "Control everything from your phone. Approve, skip, regenerate, run jobs, check stats — all via bot commands." },
  { icon: "🧠", title: "Claude AI Generation",     desc: "Every tweet, reply, thread, and LinkedIn post is AI-generated in your voice using Anthropic Claude Sonnet/Haiku." },
  { icon: "🔄", title: "Regenerate Anything",      desc: "Not happy with the draft? Hit Regenerate. Get a fresh version with one tap, without losing context." },
  { icon: "🛡️", title: "Smart Deduplication",     desc: "7-day reply memory, 7-day comment history, 30-day resurface tracking. Never repeats topics or double-replies." },
  { icon: "⏱️", title: "Fully Scheduled",         desc: "GitHub Actions fires every 15 min. IST-aligned schedule. One-tap pause from Telegram or the dashboard." },
];

const HOW_IT_WORKS = [
  { n: 1, title: "Connect your accounts",   body: "Link your X account and Telegram in minutes. Cookie-based X auth — no API keys, no rate limits, full access." },
  { n: 2, title: "AI learns your voice",    body: "Set your niche and content pillars. Claude generates tweets, threads, replies, and DMs that genuinely sound like you." },
  { n: 3, title: "Approve from Telegram",   body: "Every piece of content hits your Telegram bot first. Approve, regenerate, or skip with one tap." },
  { n: 4, title: "Engage automatically",    body: "96 automated actions per day — likes, replies, follows, go-out comments — running around the clock without you." },
  { n: 5, title: "Watch the numbers move",  body: "Daily report every night: followers gained, tweets posted, replies sent, likes given. All straight to Telegram." },
  { n: 6, title: "Never touch it again",    body: "Once set up, it runs forever. Ghost mode: your brand grows while you actually build the product." },
];

function BrowserFrame({ children, url }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.10] shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a] border-b border-white/[0.08]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto text-[11px] text-white/25 font-mono">{url ?? "phantom-beige.vercel.app"}</span>
      </div>
      {children}
    </div>
  );
}

function DashboardMockup() {
  return (
    <BrowserFrame url="phantom-beige.vercel.app/dashboard">
      <div className="bg-[#090909] text-white text-[11px] font-sans pointer-events-none select-none">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-80" />
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
              <div className="text-[9px] text-white/30 font-mono">@yourhandle</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/8 border border-red-500/30 text-[9px] text-red-400 font-medium">
              <span className="w-1 h-1 rounded-full bg-red-500" />Live
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2 px-5 pt-4 pb-3">
          {[
            { label: "Followers", value: "2.4k", red: true },
            { label: "Tweets",    value: "1.2k", red: false },
            { label: "Engagements", value: "47k", red: true },
            { label: "DMs Sent",  value: "312",  red: false },
            { label: "LI Posts",  value: "89",   red: false },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border bg-[#111] p-3 ${s.red ? "border-red-500/20" : "border-white/[0.07]"}`}>
              <div className="text-[8px] uppercase tracking-widest text-white/25 mb-1.5">{s.label}</div>
              <div className={`text-xl font-black tabular-nums ${s.red ? "text-red-400" : "text-white/70"}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <div className="flex gap-1 mb-3">
            {["queue","activity","schedule","settings"].map((t, i) => (
              <div key={t} className={`px-3 py-1.5 rounded-lg text-[9px] capitalize font-semibold ${i === 0 ? "bg-red-600 text-white" : "text-white/25"}`}>{t}{i===0 && <span className="ml-1 text-[8px] font-black bg-white text-red-600 rounded-full px-1">3</span>}</div>
            ))}
          </div>
          {[
            "The best founders I know have one thing in common: they treat distribution like a product feature, not an afterthought. Build the audience while you build the thing. 🧵",
            "Hot take: most indie hackers are over-building and under-distributing. The product is 30% of the work. The other 70% is getting people to care.",
          ].map((content, i) => (
            <div key={i} className="flex items-start gap-3 bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden mb-2">
              <div className="w-1 self-stretch bg-red-600 shrink-0" />
              <div className="flex-1 py-3 pr-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[8px] font-black uppercase text-red-400/80">Tweet</span>
                  <span className="text-[8px] text-white/20 font-mono">{i === 0 ? "7:28am" : "12:28pm"}</span>
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
    { from: "bot", text: "📊 *Daily Summary — Jun 4*\n\n📈 +18 followers (2,412 total)\n🐦 5 tweets posted\n💬 47 replies sent\n❤️ 112 likes given\n📨 4 DMs sent" },
    { from: "bot", text: "🐦 *New tweet ready*\n\nThe best personal brands aren't built in a day. They're built at 7:28am, 12:28pm, 6:28pm and 9:28pm — one tweet at a time.", hasButtons: true },
    { from: "user", text: "Post →" },
    { from: "bot", text: "✅ Posted!\nhttps://x.com/status/..." },
  ];

  return (
    <BrowserFrame url="t.me/phantomioBot">
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
                  <div className="flex-1 text-center py-1 bg-white/[0.08] rounded-lg text-[9px] text-white/50">🔄 Regen</div>
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

function WaitlistForm({ id }: { id?: string }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const text = await res.text().catch(() => "");
        let msg = "Something went wrong. Try again.";
        try { msg = JSON.parse(text).error ?? `HTTP ${res.status}`; } catch { msg = `HTTP ${res.status}`; }
        setError(msg);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div id={id} className="flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          You&apos;re on the list. We&apos;ll reach out when access opens.
        </div>
      </div>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
      <div className="flex w-full gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/25 text-sm outline-none focus:border-red-500/50 focus:bg-white/[0.08] transition-all"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-900/30 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
        >
          {submitting ? "..." : "Get early access"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <p className="text-xs text-white/25">No spam. No noise. We&apos;ll only email when access opens.</p>
    </form>
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

      {/* NAV */}
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
            <a
              href="#waitlist"
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-red-900/40"
            >
              Get early access →
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Early access — limited spots
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
            { n: "5+",  label: "posts/day" },
            { n: "0",   label: "manual effort" },
            { n: "24/7", label: "always running" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-red-400 tabular-nums">{s.n}</div>
              <div className="text-xs text-white/30 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <WaitlistForm id="waitlist" />
      </section>

      {/* DASHBOARD PREVIEW */}
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
            <p className="text-xs text-white/25 text-center">Approve, regenerate, skip — from your phone</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
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

      {/* SCHEDULE */}
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

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-widest text-white/20 mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Set it once. Run forever.</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map(s => (
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

      {/* BOTTOM CTA */}
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
              Build in public.<br />Without the grind.
            </h2>
            <p className="text-white/40 text-base max-w-xl mx-auto mb-10 leading-relaxed">
              Phantom is your AI co-founder for distribution. It handles the daily output so you can focus on building the actual product.
            </p>
            <WaitlistForm />
            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              <p className="text-xs text-white/20 mb-3">Want to self-host today?</p>
              <a
                href="https://github.com/Bigreddroid/Phantom-v1"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-white/35 hover:text-white/60 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
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
