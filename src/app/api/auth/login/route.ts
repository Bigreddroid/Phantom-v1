import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string };

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "DASHBOARD_PASSWORD not configured" }, { status: 500 });
  }

  // Constant-time comparison to prevent timing attacks
  const pwdBuf = Buffer.from(password ?? "");
  const expBuf = Buffer.from(expected);
  const valid = pwdBuf.length === expBuf.length &&
    crypto.timingSafeEqual(pwdBuf, expBuf);

  if (!valid) {
    // Fixed delay to slow brute-force
    await new Promise(r => setTimeout(r, 500));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET!;
  const token = await deriveToken(secret);

  // Validate redirect target — only allow same-origin paths
  const raw = req.nextUrl.searchParams.get("from") ?? "/dashboard";
  const from = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  const res = NextResponse.redirect(new URL(from, req.url));
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
