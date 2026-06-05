"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") ?? "/";

  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/auth/login?from=${encodeURIComponent(from)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.redirected) {
      window.location.href = res.url;
      return;
    }

    const data = await res.json().catch(() => ({})) as { error?: string };
    setError(data.error ?? "Login failed");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#090909] flex items-center justify-center p-4">
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-80" />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-600 to-red-900 shadow-lg shadow-red-900/40" />
            <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="8" cy="8" r="2" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">PHANTOM</span>
        </div>

        <form onSubmit={submit} className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white/70 mb-1">Dashboard password</p>
            {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
              <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-3">
                Demo mode — use password <code className="font-mono font-bold">demo</code>
              </p>
            )}
            <p className="text-xs text-white/30 mb-4">Or <a href="/signup" className="text-red-400 hover:text-red-300 transition-colors">create an account</a> to get your own Phantom instance.</p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all font-mono"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-red-900/40"
          >
            {loading ? "…" : "Enter →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
