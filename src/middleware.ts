import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";

const LEGACY_COOKIE  = "phantom_auth";
const SESSION_COOKIE = "phantom_session";

async function deriveLegacyToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("phantom_dashboard_v1"));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Paths that never require auth
const PUBLIC = [
  "/",
  "/login",
  "/signup",
  "/onboarding",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/telegram",
  "/api/waitlist",
  "/api/billing/webhook",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC.some(p =>
    pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")
  );
  if (isPublic) return NextResponse.next();

  // Cron/job calls authenticated with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${cronSecret}`) return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.redirect(new URL("/login", request.url));

  // ── Check new JWT session ──────────────────────────────────────────────────
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    const session = await verifySession(sessionToken);
    if (session) {
      // Inject userId as header so API routes can read it without re-parsing JWT
      const headers = new Headers(request.headers);
      headers.set("x-phantom-user-id", session.userId);
      headers.set("x-phantom-email", session.email);
      return NextResponse.next({ request: { headers } });
    }
  }

  // ── Fall back to legacy single-password token (Varun's dashboard) ──────────
  const expected   = await deriveLegacyToken(secret);
  const legacyToken = request.cookies.get(LEGACY_COOKIE)?.value;
  if (legacyToken === expected) return NextResponse.next();

  // Not authenticated — redirect to login
  const loginUrl = new URL("/login", request.url);
  const safePath = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/dashboard";
  loginUrl.searchParams.set("from", safePath);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
