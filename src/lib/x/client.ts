import { TwitterApi } from "twitter-api-v2";
import { Scraper } from "agent-twitter-client";
import { Scraper as ConvoScraper, SearchMode as ConvoSearchMode } from "@the-convocation/twitter-scraper";
import { prisma } from "@/lib/db";

// ── twitter-api-v2 (official API — DMs, media upload) ────────────────────
// Lazily initialised — prevents "Invalid consumer tokens" during Next.js
// build-time page-data collection when env vars are absent.
let _twitterApi: TwitterApi | undefined;
function getTwitterApi(): TwitterApi {
  if (!_twitterApi) {
    _twitterApi = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
    });
  }
  return _twitterApi;
}

type XRW = TwitterApi["readWrite"];
type XRO = TwitterApi["readOnly"];

export const xRW: XRW = new Proxy({} as XRW, {
  get(_, prop: string | symbol) {
    const rw = getTwitterApi().readWrite;
    const val = Reflect.get(rw as object, prop, rw);
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(rw) : val;
  },
});

export const xRO: XRO = new Proxy({} as XRO, {
  get(_, prop: string | symbol) {
    const ro = getTwitterApi().readOnly;
    const val = Reflect.get(ro as object, prop, ro);
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(ro) : val;
  },
});

// ── agent-twitter-client (cookie-based — tweet posting, likes, retweets) ──
let _scraper: Scraper | null = null;
let _lastCheck = 0;

// Shared: apply cookies to a scraper instance and prime the guest token.
async function primeScraper(scraper: Scraper, cookieStrings: string[]) {
  const normalized = cookieStrings.map(c => c.replace(/Domain=\.?twitter\.com/gi, "Domain=.x.com"));
  await scraper.setCookies(normalized);
  try {
    const res = await fetch("https://api.x.com/1.1/guest/activate.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    });
    if (res.ok) {
      const { guest_token } = await res.json() as { guest_token: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scraper as unknown as any).auth.guestToken = guest_token;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scraper as unknown as any).authTrends.guestToken = guest_token;
    }
  } catch { /* ok */ }
}

// Varun's singleton scraper — reads X_COOKIES env var (or XSession DB fallback).
// Untouched: all existing automation continues to use this.
export async function getXClient(): Promise<Scraper> {
  const now = Date.now();
  if (_scraper && now - _lastCheck < 300_000) return _scraper;

  const scraper = new Scraper();

  if (process.env.X_COOKIES) {
    const cookieStrings: string[] = JSON.parse(process.env.X_COOKIES);
    await primeScraper(scraper, cookieStrings);
    _scraper = scraper;
    _lastCheck = now;
    return scraper;
  }

  const session = await prisma.xSession.findUnique({ where: { id: "singleton" } });
  if (session?.cookies) {
    const cookieStrings: string[] = JSON.parse(session.cookies);
    await primeScraper(scraper, cookieStrings);
    _scraper = scraper;
    _lastCheck = now;
    return scraper;
  }

  await scraper.login(
    process.env.X_USERNAME!,
    process.env.X_PASSWORD!,
    process.env.X_EMAIL,
  );
  if (!(await scraper.isLoggedIn())) {
    throw new Error("X login failed — set X_COOKIES env var via get-cookies.js script");
  }

  const cookies = await scraper.getCookies();
  const cookieStrings = cookies.map(c =>
    `${c.key}=${c.value}; Domain=${c.domain}; Path=${c.path}${c.secure ? "; Secure" : ""}${c.httpOnly ? "; HttpOnly" : ""}`
  );
  await prisma.xSession.upsert({
    where: { id: "singleton" },
    update: { cookies: JSON.stringify(cookieStrings) },
    create: { id: "singleton", cookies: JSON.stringify(cookieStrings) },
  });

  _scraper = scraper;
  _lastCheck = now;
  return scraper;
}

// ── Per-user clients (multi-tenant) ──────────────────────────────────────────
// These are NOT cached — each call creates a fresh client for the given user.
// Used by per-user cron dispatch (not yet wired) and credential validation.

// Cookie-based scraper for a specific SaaS user.
export async function getXClientForUser(userId: string): Promise<Scraper> {
  const cred = await prisma.xCredential.findUnique({ where: { userId } });
  if (!cred || cred.authMethod !== "cookies" || !cred.cookies) {
    throw new Error(`User ${userId} does not have cookie-based X auth configured`);
  }
  const scraper = new Scraper();
  const cookieStrings: string[] = JSON.parse(cred.cookies);
  await primeScraper(scraper, cookieStrings);
  return scraper;
}

// Official API client for a specific SaaS user (authMethod="api").
export async function getApiClientForUser(userId: string): Promise<TwitterApi> {
  const cred = await prisma.xCredential.findUnique({ where: { userId } });
  if (!cred || cred.authMethod !== "api") {
    throw new Error(`User ${userId} does not have API-based X auth configured`);
  }
  if (!cred.apiKey || !cred.apiSecret || !cred.accessToken || !cred.accessSecret) {
    throw new Error(`Incomplete API credentials for user ${userId}`);
  }
  return new TwitterApi({
    appKey: cred.apiKey,
    appSecret: cred.apiSecret,
    accessToken: cred.accessToken,
    accessSecret: cred.accessSecret,
  });
}

// ── @the-convocation/twitter-scraper (reads — up-to-date GraphQL endpoints) ─
let _convoScraper: ConvoScraper | null = null;
export { ConvoSearchMode };

export async function getConvoScraper(): Promise<ConvoScraper> {
  if (_convoScraper) return _convoScraper;
  const s = new ConvoScraper();

  // Priority 1: X_COOKIES env var
  let cookieStrings: string[] | null = null;
  if (process.env.X_COOKIES) {
    cookieStrings = JSON.parse(process.env.X_COOKIES);
  } else {
    // Priority 2: XSession DB (same session that getXClient() creates/uses)
    const session = await prisma.xSession.findUnique({ where: { id: "singleton" } });
    if (session?.cookies) cookieStrings = JSON.parse(session.cookies);
  }

  if (cookieStrings?.length) {
    const normalized = cookieStrings.map(c =>
      c.replace(/Domain=\.?twitter\.com/gi, "Domain=.x.com")
    );
    await s.setCookies(normalized);
  } else {
    // No cookies at all — prime getXClient() so it logs in and stores the session,
    // then retry with the freshly saved cookies.
    await getXClient();
    const session = await prisma.xSession.findUnique({ where: { id: "singleton" } });
    if (session?.cookies) {
      const normalized = (JSON.parse(session.cookies) as string[]).map(c =>
        c.replace(/Domain=\.?twitter\.com/gi, "Domain=.x.com")
      );
      await s.setCookies(normalized);
    }
  }

  _convoScraper = s;
  return s;
}
