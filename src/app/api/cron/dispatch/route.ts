import { NextResponse } from "next/server";

export const maxDuration = 60;

// Single dispatcher — hits every 15 min from cron-job.org, routes internally based on IST time.
// cron-job.org setup: https://cron-job.org → New → URL: https://phantom-beige.vercel.app/api/cron/dispatch
//   Authorization header: Bearer <CRON_SECRET>   Interval: every 15 min

const BASE = process.env.NEXTAUTH_URL ?? "";
const SECRET = process.env.CRON_SECRET ?? "";

function hit(path: string) {
  return fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${SECRET}` },
  }).catch(() => null);
}

export async function GET(req: Request) {
  const auth    = req.headers.get("authorization");
  const qSecret = new URL(req.url).searchParams.get("secret");
  if (auth !== `Bearer ${SECRET}` && qSecret !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour   = now.getHours();
  const minute = now.getMinutes();
  const dow    = now.getDay(); // 0=Sun, 1=Mon … 6=Sat

  const at = (h: number, m: number, window = 10) =>
    hour === h && minute >= m && minute < m + window;

  const jobs: Promise<unknown>[] = [];

  // ── Every 15 min, 24/7 ──────────────────────────────────────────────────
  jobs.push(hit("/api/cron/mentions"));
  jobs.push(hit("/api/cron/engage"));

  // ── Hourly watchdog (fires at :00 and :15) ───────────────────────────────
  if (minute < 20) jobs.push(hit("/api/cron/watchdog"));

  // ── Tweets — 4×/day: 7:30, 12:30, 18:30, 21:30 IST ─────────────────────
  if (at(7, 28) || at(12, 28) || at(18, 28) || at(21, 28))
    jobs.push(hit("/api/cron/tweet"));

  // ── Threads — Mon & Thu 14:30 IST ────────────────────────────────────────
  if ((dow === 1 || dow === 4) && at(14, 28))
    jobs.push(hit("/api/cron/thread"));

  // ── Follow — 9:30, 15:30, 20:30 IST ─────────────────────────────────────
  if (at(9, 28) || at(15, 28) || at(20, 28))
    jobs.push(hit("/api/cron/follow"));

  // ── LinkedIn — Tue–Fri 8:30 IST ──────────────────────────────────────────
  if (dow >= 2 && dow <= 5 && at(8, 28))
    jobs.push(hit("/api/cron/linkedin"));

  // ── Resurface — daily 10:30 IST ──────────────────────────────────────────
  if (at(10, 28)) jobs.push(hit("/api/cron/resurface"));

  // ── Niche RT — daily 16:30 IST ───────────────────────────────────────────
  if (at(16, 28)) jobs.push(hit("/api/cron/niche-rt"));

  // ── Auto DM — daily 13:30 IST ────────────────────────────────────────────
  if (at(13, 28)) jobs.push(hit("/api/cron/dm"));

  // ── Auto Goout — 5×/day: 9, 11, 14, 17, 20 IST ──────────────────────────
  if (at(9, 0) || at(11, 0) || at(14, 0) || at(17, 0) || at(20, 0))
    jobs.push(hit("/api/cron/goout"));

  // ── Daily summary — 23:30 IST ────────────────────────────────────────────
  if (at(23, 28)) jobs.push(hit("/api/cron/summary"));

  await Promise.allSettled(jobs);

  return NextResponse.json({ ok: true, hour, minute, dow, jobs: jobs.length });
}
