import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "phantom_auth";

async function deriveToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("phantom_dashboard_v1"),
  );
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

const PUBLIC = ["/", "/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC.some(p => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
  if (isPublic) return NextResponse.next();

  // Allow internal cron/job calls authenticated with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${cronSecret}`) return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Fail closed — never silently expose the app if secret is misconfigured
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const expected = await deriveToken(secret);
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (token !== expected) {
    const loginUrl = new URL("/login", request.url);
    // Validate from param: only allow same-origin paths
    const safePath = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/dashboard";
    loginUrl.searchParams.set("from", safePath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
