import { cookies } from "next/headers";

const SESSION_COOKIE = "phantom_session";
const LEGACY_COOKIE  = "phantom_auth";

export interface Session {
  userId: string;
  email:  string;
}

// ── JWT-lite using Web Crypto (no external library) ───────────────────────────

async function getKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.NEXTAUTH_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64url(buf: ArrayBuffer | Uint8Array) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(u8).toString("base64url");
}

function fromB64url(s: string): ArrayBuffer {
  return new Uint8Array(Buffer.from(s, "base64url")).buffer as ArrayBuffer;
}

export async function signSession(payload: Session): Promise<string> {
  const header  = b64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })).buffer as ArrayBuffer);
  const body    = b64url(new TextEncoder().encode(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })).buffer as ArrayBuffer);
  const key     = await getKey();
  const sig     = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const key   = await getKey();
    const valid = await crypto.subtle.verify("HMAC", key, fromB64url(sig), new TextEncoder().encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(Buffer.from(fromB64url(body)).toString()) as Session & { iat?: number };
    if (!payload.userId || !payload.email) return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar   = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Checks both new JWT session and old single-password token
export async function getLegacyToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(LEGACY_COOKIE)?.value ?? null;
}

export function sessionCookieOpts(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  };
}
