"use client";

import { useEffect, useState, useCallback } from "react";

type QueueItem = { id: string; type: string; content: string; status: string; createdAt: string };
type ActivityItem = { id: string; action: string; detail?: string; icon?: string; createdAt: string };
type Stats = { followers: number; following: number; tweets: number; engagements: number; dmsSent: number };

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
    { label: "Followers", value: stats?.followers ?? "—" },
    { label: "Tweets", value: stats?.tweets ?? "—" },
    { label: "Engagements", value: stats?.engagements ?? "—" },
    { label: "DMs Sent", value: stats?.dmsSent ?? "—" },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white text-black text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <span className="text-black text-sm font-bold">P</span>
          </div>
          <span className="font-semibold text-lg tracking-tight">Phantom</span>
          <span className="text-xs text-white/30 ml-1">{process.env.NEXT_PUBLIC_X_HANDLE ?? "@BigRedDr0id"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full inline-block ${refreshing ? "bg-yellow-400 animate-pulse" : "bg-green-400 animate-pulse"}`} />
          <span className="text-sm text-white/50">{refreshing ? "Syncing..." : "Running"}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-10">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{s.label}</p>
              <p className="text-3xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Run Jobs */}
        <div>
          <h2 className="text-white/50 text-xs uppercase tracking-widest mb-4">Run Now</h2>
          <div className="flex flex-wrap gap-3">
            {JOBS.map((job) => (
              <button
                key={job.label}
                onClick={() => runJob(job.endpoint, job.label)}
                disabled={loading === job.label}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading === job.label ? "Running..." : job.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-6 border-b border-white/10 mb-6">
            {(["queue", "activity", "schedule", "settings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm capitalize transition-colors ${
                  activeTab === tab ? "text-white border-b-2 border-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                {tab}
                {tab === "queue" && queue.length > 0 && (
                  <span className="ml-2 text-xs bg-white text-black rounded-full px-1.5 py-0.5">{queue.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Queue */}
          {activeTab === "queue" && (
            <div className="space-y-3">
              {queue.length === 0 && (
                <p className="text-white/20 text-sm py-6">Queue is empty — run a job to generate content.</p>
              )}
              {queue.map((item) => (
                <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white/30 uppercase tracking-widest">{item.type}</span>
                    <p className="text-sm mt-1 text-white/80 whitespace-pre-line line-clamp-3">{item.content}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleQueue(item.id, "approve")}
                      disabled={loading === item.id}
                      className="px-3 py-1.5 bg-white text-black text-xs rounded-full font-medium hover:bg-white/90 transition-colors disabled:opacity-40"
                    >
                      {loading === item.id ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleQueue(item.id, "reject")}
                      disabled={loading === item.id}
                      className="px-3 py-1.5 border border-white/10 text-xs rounded-full hover:bg-white/5 transition-colors disabled:opacity-40"
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
            <div className="space-y-1">
              {activity.length === 0 && (
                <p className="text-white/20 text-sm py-6">No activity yet.</p>
              )}
              {activity.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-3 border-b border-white/5">
                  <span className="text-lg w-6 text-center">{item.icon ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.action}</p>
                    {item.detail && <p className="text-xs text-white/30 truncate">{item.detail}</p>}
                  </div>
                  <span className="text-xs text-white/20 shrink-0">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Schedule */}
          {activeTab === "schedule" && (
            <div className="space-y-3">
              {[
                { job: "Tweets", times: "7:30am · 12:30pm · 6:30pm", freq: "3x / day", note: "±15min random offset · 15% skip chance", next: "12:30pm today" },
                { job: "Threads", times: "Monday & Thursday · 2:30pm", freq: "2x / week", note: "20% skip chance", next: "Monday 2:30pm" },
                { job: "Engagement", times: "Every 2 hours · 7am–10pm", freq: "8x / day", note: "Likes target accounts · active hours only", next: "Next even hour" },
                { job: "Mentions check", times: "Every 30 minutes", freq: "48x / day", note: "Replies queued for approval", next: "In ~15 min" },
                { job: "Daily summary", times: "11:30pm every day", freq: "1x / day", note: "Telegram report — followers, tweets, engagements", next: "Tonight 11:30pm" },
              ].map((s) => (
                <div key={s.job} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{s.job}</p>
                      <p className="text-white/40 text-xs mt-1">{s.times}</p>
                      <p className="text-white/20 text-xs mt-0.5">{s.note}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white/60 text-sm">{s.freq}</p>
                      <p className="text-green-400 text-xs mt-1">Next: {s.next}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Settings */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-medium">Content Pillars</h3>
                {["Building a personal brand as a founder", "AI automation for solopreneurs", "Building in public", "Growing an audience without ads", "Tech + personal branding"].map((p) => (
                  <div key={p} className="flex items-center gap-3 text-sm text-white/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />{p}
                  </div>
                ))}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-medium">Automation Schedule (IST)</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { job: "Tweets", times: "7:30am · 12:30pm · 6:30pm", freq: "3x / day", note: "±15min random offset" },
                    { job: "Threads", times: "Monday & Thursday · 2:30pm", freq: "2x / week", note: "20% skip chance" },
                    { job: "Engagement", times: "Every 2 hours · 7am–10pm", freq: "8x / day", note: "Likes, active hours only" },
                    { job: "Mentions", times: "Every 30 minutes", freq: "48x / day", note: "Queued for approval" },
                  ].map((s) => (
                    <div key={s.job} className="flex items-start justify-between gap-4 py-2 border-b border-white/5">
                      <div>
                        <p className="text-white">{s.job}</p>
                        <p className="text-white/30 text-xs mt-0.5">{s.times}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-white/60">{s.freq}</p>
                        <p className="text-white/20 text-xs mt-0.5">{s.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
