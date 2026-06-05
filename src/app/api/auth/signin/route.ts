import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/user";
import { signSession, sessionCookieOpts } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  // Minimum delay to slow brute-force
  await new Promise(r => setTimeout(r, 300));

  const user = await verifyUser(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signSession({ userId: user.id, email: user.email });
  const res   = NextResponse.json({
    ok: true,
    userId: user.id,
    onboardingDone: user.onboardingDone,
    plan: user.plan,
  });
  res.cookies.set(sessionCookieOpts(token));
  return res;
}
