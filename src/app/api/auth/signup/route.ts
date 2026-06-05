import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/auth/user";
import { signSession, sessionCookieOpts } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json() as { email?: string; password?: string; name?: string };

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const user  = await createUser(email, password, name);
    const token = await signSession({ userId: user.id, email: user.email });
    const res   = NextResponse.json({ ok: true, userId: user.id });
    res.cookies.set(sessionCookieOpts(token));
    return res;
  } catch (e: unknown) {
    const msg = String(e);
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
