"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "x" | "telegram" | "voice" | "done";

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: "x",        label: "Connect X",       icon: "𝕏" },
  { id: "telegram", label: "Telegram Bot",     icon: "✈️" },
  { id: "voice",    label: "Your Voice",       icon: "🎙️" },
  { id: "done",     label: "Launch",           icon: "🚀" },
];

// ── Step 1: X Account Setup (cookies OR official API) ────────────────────────
function StepX({ onDone }: { onDone: () => void }) {
  const [authMethod, setAuthMethod] = useState<"cookies" | "api">("cookies");
  const [cookies,  setCookies]  = useState("");
  const [username, setUsername] = useState("");
  const [apiKey,   setApiKey]   = useState("");
  const [apiSecret,    setApiSecret]    = useState("");
  const [accessToken,  setAccessToken]  = useState("");
  const [accessSecret, setAccessSecret] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    setError("");
    if (!username.trim()) { setError("X username is required"); return; }

    if (authMethod === "api") {
      if (!apiKey.trim() || !apiSecret.trim() || !accessToken.trim() || !accessSecret.trim()) {
        setError("All four API key fields are required"); return;
      }
    } else {
      if (!cookies.trim()) { setError("Cookie JSON is required"); return; }
    }

    setLoading(true);
    try {
      const payload = authMethod === "api"
        ? { step: "x", authMethod: "api", username: username.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), accessToken: accessToken.trim(), accessSecret: accessSecret.trim() }
        : { step: "x", authMethod: "cookies", username: username.trim(), cookies: cookies.trim() };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onDone();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white mb-1">Connect your X account</h2>
        <p className="text-sm text-white/40">Choose how Phantom authenticates with X.</p>
      </div>

      {/* Auth method toggle */}
      <div className="flex gap-2 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl">
        <button
          onClick={() => { setAuthMethod("cookies"); setError(""); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${authMethod === "cookies" ? "bg-red-600 text-white shadow" : "text-white/40 hover:text-white/60"}`}
        >
          Browser Cookies
        </button>
        <button
          onClick={() => { setAuthMethod("api"); setError(""); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${authMethod === "api" ? "bg-red-600 text-white shadow" : "text-white/40 hover:text-white/60"}`}
        >
          Official API Keys
        </button>
      </div>

      {authMethod === "cookies" ? (
        <>
          <div className="bg-[#161616] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-white/30">How to get your cookies</p>
            {[
              "Open Brave or Chrome and log in to X (Twitter)",
              "Press F12 → Application tab → Cookies → x.com",
              "Copy all cookies as JSON (or use get-cookies.js from the GitHub repo)",
              "Paste the JSON array below",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/20 text-red-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-[13px] text-white/50 leading-relaxed">{s}</p>
              </div>
            ))}
            <a
              href="https://github.com/Bigreddroid/Phantom-v1" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors mt-1"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              View get-cookies.js script →
            </a>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["Full access (tweets, DMs, likes, follows, mentions)", "Refresh every ~30 days"].map(f => (
                <span key={f} className="text-[11px] text-green-400/80 bg-green-500/10 border border-green-500/15 rounded-md px-2 py-0.5">{f}</span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">Your X username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="@yourhandle"
                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">Cookie JSON</label>
              <textarea
                value={cookies} onChange={e => setCookies(e.target.value)}
                placeholder={'[{"key":"ct0","value":"..."},{"key":"auth_token","value":"..."}]'}
                rows={5}
                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-xs text-white/70 placeholder-white/15 outline-none focus:border-red-500/50 transition-all font-mono resize-none"
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="bg-[#161616] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-white/30">Get your API keys</p>
            {[
              "Go to developer.x.com → Projects & Apps → create an app",
              "Under User authentication settings, enable Read + Write",
              "Generate Access Token and Access Token Secret",
              "Copy all four values below",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/20 text-red-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-[13px] text-white/50 leading-relaxed">{s}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["Tweets & likes: Free tier", "DMs & search: Pro tier ($5k/mo)", "No cookie refresh needed"].map(f => (
                <span key={f} className={`text-[11px] rounded-md px-2 py-0.5 border ${f.includes("Free") || f.includes("No cookie") ? "text-green-400/80 bg-green-500/10 border-green-500/15" : "text-yellow-400/80 bg-yellow-500/10 border-yellow-500/15"}`}>{f}</span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">Your X username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="@yourhandle"
                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">API Key</label>
                <input
                  type="text" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="API Key"
                  className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-3 py-3 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">API Secret</label>
                <input
                  type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)}
                  placeholder="API Secret"
                  className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-3 py-3 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">Access Token</label>
                <input
                  type="text" value={accessToken} onChange={e => setAccessToken(e.target.value)}
                  placeholder="Access Token"
                  className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-3 py-3 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">Access Token Secret</label>
                <input
                  type="password" value={accessSecret} onChange={e => setAccessSecret(e.target.value)}
                  placeholder="Access Token Secret"
                  className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-3 py-3 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all font-mono"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={submit} disabled={loading}
        className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {loading ? "Verifying…" : "Save & continue →"}
      </button>
    </div>
  );
}

// ── Step 2: Telegram Setup ────────────────────────────────────────────────────
function StepTelegram({ onDone }: { onDone: () => void }) {
  const [botToken, setBotToken] = useState("");
  const [chatId,   setChatId]   = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [botName,  setBotName]  = useState("");

  const submit = async () => {
    setError(""); setBotName("");
    if (!botToken.trim() || !chatId.trim()) { setError("Both fields are required"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "telegram", botToken: botToken.trim(), chatId: chatId.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; botName?: string };
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      if (data.botName) setBotName(data.botName);
      setTimeout(onDone, 1200);
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white mb-1">Set up your Telegram bot</h2>
        <p className="text-sm text-white/40">Your personal bot is your control panel — approve posts, run jobs, check stats.</p>
      </div>

      <div className="bg-[#161616] border border-white/[0.08] rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-white/30">Create your bot</p>
        {[
          { n: 1, text: "Open Telegram and message @BotFather" },
          { n: 2, text: "Send /newbot — follow the prompts, pick a name & username" },
          { n: 3, text: "Copy the bot token it gives you" },
          { n: 4, text: "Message @userinfobot — it replies with your numeric Chat ID" },
        ].map(s => (
          <div key={s.n} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/20 text-red-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
            <p className="text-[13px] text-white/50 leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-white/50 mb-1.5 block">Bot token</label>
          <input
            type="text" value={botToken} onChange={e => setBotToken(e.target.value)}
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/50 mb-1.5 block">Your chat ID</label>
          <input
            type="text" value={chatId} onChange={e => setChatId(e.target.value)}
            placeholder="6061651803"
            className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all font-mono"
          />
        </div>
      </div>

      {botName && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <span className="text-green-400 text-sm">✓</span>
          <p className="text-sm text-green-300">Connected to @{botName}! Webhook registered.</p>
        </div>
      )}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={submit} disabled={loading}
        className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {loading ? "Connecting…" : "Connect & continue →"}
      </button>
    </div>
  );
}

// ── Step 3: Voice & Niche ─────────────────────────────────────────────────────
function StepVoice({ onDone }: { onDone: () => void }) {
  const [handle,          setHandle]          = useState("");
  const [nicheKeywords,   setNicheKeywords]   = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  const submit = async () => {
    setError("");
    if (!handle.trim()) { setError("X handle is required"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "settings",
          handle: handle.trim(),
          nicheKeywords,
          voiceDescription,
          contentTopics: "",
          threadTopics: "",
          voiceTopics: nicheKeywords,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onDone();
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white mb-1">Your voice & niche</h2>
        <p className="text-sm text-white/40">Phantom writes in your voice. Give it enough to sound like you, not like a bot.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/50 mb-1.5 block">X handle</label>
          <input
            type="text" value={handle} onChange={e => setHandle(e.target.value)}
            placeholder="@yourhandle" required
            className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-white/50 mb-1.5 block">Niche keywords <span className="text-white/20 font-normal">(comma-separated)</span></label>
          <input
            type="text" value={nicheKeywords} onChange={e => setNicheKeywords(e.target.value)}
            placeholder="founder personal brand, AI automation, building in public"
            className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50 transition-all"
          />
          <p className="text-xs text-white/25 mt-1">Used for engagement targeting — what Phantom likes, replies to, and follows</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-white/50 mb-1.5 block">Describe your voice</label>
          <textarea
            value={voiceDescription} onChange={e => setVoiceDescription(e.target.value)}
            placeholder={"Direct and confident. Occasional dry humor. Never use buzzwords. Talk like a builder to another builder, not a marketer. First person, no corporate speak."}
            rows={4}
            className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/15 outline-none focus:border-red-500/50 transition-all resize-none leading-relaxed"
          />
          <p className="text-xs text-white/25 mt-1">This shapes every tweet, reply, and DM Phantom writes for you</p>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={submit} disabled={loading || !handle}
        className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {loading ? "Saving…" : "Finish setup →"}
      </button>
    </div>
  );
}

// ── Step 4: Done ──────────────────────────────────────────────────────────────
function StepDone() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const startTrial = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "starter" }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
      else router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  };

  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-2xl shadow-red-900/40">
        <svg className="w-10 h-10 p-1" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          <circle cx="8" cy="8" r="2" fill="white"/>
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-black text-white">You're all set.</h2>
        <p className="text-white/40 mt-2 text-sm leading-relaxed max-w-xs mx-auto">
          Phantom is ready to run your account on autopilot. Start your 14-day free trial — no card required.
        </p>
      </div>

      <div className="bg-[#161616] border border-white/[0.08] rounded-2xl p-5 text-left space-y-2">
        {[
          "Tweets 4× daily at peak hours",
          "Engages your niche 96× per day",
          "Replies to every mention automatically",
          "Drops comments on trending threads",
          "Sends you a daily report via Telegram",
        ].map(item => (
          <div key={item} className="flex items-center gap-3">
            <span className="text-red-400 text-sm shrink-0">✓</span>
            <p className="text-sm text-white/60">{item}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={startTrial} disabled={loading}
          className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-red-900/30"
        >
          {loading ? "Redirecting…" : "Start 14-day free trial →"}
        </button>
        <a
          href="/dashboard"
          className="block w-full py-2.5 text-center border border-white/[0.07] text-white/35 hover:text-white/55 text-sm rounded-xl hover:bg-white/[0.03] transition-all"
        >
          Go to dashboard first
        </a>
      </div>

      <p className="text-xs text-white/20">After trial: $29/mo. Cancel anytime.</p>
    </div>
  );
}

// ── Main onboarding shell ─────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router  = useRouter();
  const [step, setStep] = useState<Step>("x");
  const [checkDone, setCheckDone] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding")
      .then(r => r.json())
      .then((data: { done?: boolean; step?: number }) => {
        if (data.done) { router.replace("/dashboard"); return; }
        const s = data.step ?? 0;
        if (s === 1) setStep("telegram");
        else if (s === 2) setStep("voice");
        else if (s >= 3) setStep("done");
        setCheckDone(true);
      })
      .catch(() => setCheckDone(true));
  }, [router]);

  if (!checkDone) return (
    <div className="min-h-screen bg-[#090909] flex items-center justify-center">
      <div className="w-5 h-5 border border-white/20 border-t-red-500 rounded-full animate-spin" />
    </div>
  );

  const currentIdx = STEPS.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-[#090909] text-white font-sans antialiased">
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent z-50 opacity-80" />

      {/* Header */}
      <div className="flex items-center justify-between max-w-lg mx-auto px-6 pt-8 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-red-900">
            <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-1.5">
              <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight">PHANTOM</span>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < currentIdx ? "w-6 bg-red-500" :
                i === currentIdx ? "w-8 bg-red-500" :
                "w-4 bg-white/[0.12]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step label */}
      <div className="max-w-lg mx-auto px-6 mb-6">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-1.5 ${i === currentIdx ? "text-white/70" : i < currentIdx ? "text-white/30" : "text-white/15"}`}>
              {i > 0 && <span className="text-white/10 text-xs">›</span>}
              <span className="text-xs font-semibold">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-6 pb-16">
        <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6">
          {step === "x"        && <StepX        onDone={() => setStep("telegram")} />}
          {step === "telegram" && <StepTelegram  onDone={() => setStep("voice")} />}
          {step === "voice"    && <StepVoice     onDone={() => setStep("done")} />}
          {step === "done"     && <StepDone />}
        </div>
      </div>
    </div>
  );
}
