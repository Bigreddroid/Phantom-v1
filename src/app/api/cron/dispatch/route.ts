import { NextResponse } from "next/server";

export const maxDuration = 60;

// Single dispatcher — hits every 15 min from cron-job.org, routes internally based on IST time.
// cron-job.org setup: https://cron-job.org → New → URL: https://phantom-beige.vercel.app/api/cron/dispatch
//   Authorization header: Bearer <CRON_SECRET>   Interval: every 15 min

const BASE   = process.env.NEXTAUTH_URL ?? "";
const SECRET = process.env.CRON_SECRET ?? "";

function hit(path: string) {
  return fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${SECRET}` },
  }).catch(() => null);
}

// Weighted random pick — weights don't need to sum to 1, just relative
function pick<T>(options: Array<{ weight: number; value: T }>): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now    = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour   = now.getHours();
  const minute = now.getMinutes();
  const dow    = now.getDay(); // 0=Sun … 6=Sat

  const at = (h: number, m: number, window = 10) =>
    hour === h && minute >= m && minute < m + window;

  const jobs: Promise<unknown>[] = [];
  const fired: string[] = [];

  // ── Every 15 min, 24/7 ──────────────────────────────────────────────────────
  jobs.push(hit("/api/cron/mentions")); fired.push("mentions");
  jobs.push(hit("/api/cron/engage"));  fired.push("engage");

  // ── Hourly watchdog ─────────────────────────────────────────────────────────
  if (minute < 20) {
    jobs.push(hit("/api/cron/watchdog")); fired.push("watchdog");
  }

  // ── Posting slots — 4×/day: 7:30, 12:30, 18:30, 21:30 IST ─────────────────
  // Each slot randomly picks a content type — never the same predictable pattern
  if (at(7, 28) || at(12, 28) || at(18, 28) || at(21, 28)) {
    const contentType = pick([
      { weight: 35, value: "/api/cron/tweet?image=false" }, // plain tweet
      { weight: 30, value: "/api/cron/tweet?image=true"  }, // tweet with image
      { weight: 20, value: "/api/cron/thread"             }, // thread
      { weight: 15, value: "/api/cron/resurface"          }, // resurface old tweet
    ]);
    jobs.push(hit(contentType));
    fired.push(`post:${contentType.split("/").pop()}`);
  }

  // ── Bonus thread — Mon & Thu 14:30 IST (on top of whatever the slot picked) ─
  if ((dow === 1 || dow === 4) && at(14, 28)) {
    jobs.push(hit("/api/cron/thread")); fired.push("bonus-thread");
  }

  // ── Follow — 9:30, 15:30, 20:30 IST ────────────────────────────────────────
  if (at(9, 28) || at(15, 28) || at(20, 28)) {
    jobs.push(hit("/api/cron/follow")); fired.push("follow");
  }

  // ── LinkedIn — Tue–Fri 8:30 IST ─────────────────────────────────────────────
  if (dow >= 2 && dow <= 5 && at(8, 28)) {
    // Randomly pick LinkedIn post type each day
    const liType = pick([
      { weight: 50, value: "/api/cron/linkedin"       }, // thought leadership
      { weight: 30, value: "/api/jobs/linkedin-story" }, // personal story
      { weight: 20, value: "/api/jobs/linkedin-list"  }, // 5-lesson list
    ]);
    jobs.push(hit(liType)); fired.push(`li:${liType.split("/").pop()}`);
  }

  // ── Niche RT — daily 16:30 IST ───────────────────────────────────────────────
  if (at(16, 28)) {
    jobs.push(hit("/api/cron/niche-rt")); fired.push("niche-rt");
  }

  // ── Auto DM — daily 13:30 IST ────────────────────────────────────────────────
  if (at(13, 28)) {
    jobs.push(hit("/api/cron/dm")); fired.push("dm");
  }

  // ── Go-out — 5×/day: 9, 11, 14, 17, 20 IST ──────────────────────────────────
  if (at(9, 0) || at(11, 0) || at(14, 0) || at(17, 0) || at(20, 0)) {
    jobs.push(hit("/api/cron/goout")); fired.push("goout");
  }

  // ── Daily summary — 23:30 IST ────────────────────────────────────────────────
  if (at(23, 28)) {
    jobs.push(hit("/api/cron/summary")); fired.push("summary");
  }

  await Promise.allSettled(jobs);

  return NextResponse.json({ ok: true, hour, minute, dow, fired });
}
