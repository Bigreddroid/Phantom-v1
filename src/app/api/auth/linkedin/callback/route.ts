import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const base = process.env.NEXTAUTH_URL!;

  if (error) {
    return NextResponse.redirect(`${base}/?li=denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("li_oauth_state")?.value;

  // CSRF guard — state must match what we set before the redirect
  if (!code || !savedState || state !== savedState) {
    return NextResponse.redirect(`${base}/?li=invalid`);
  }

  cookieStore.delete("li_oauth_state");

  // Exchange code for tokens
  let tokenData: {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${base}/api/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("LinkedIn token exchange failed:", err);
      return NextResponse.redirect(`${base}/?li=token_error`);
    }

    tokenData = await tokenRes.json();
  } catch (e) {
    console.error("LinkedIn token exchange threw:", e);
    return NextResponse.redirect(`${base}/?li=token_error`);
  }

  // Fetch person ID — required for authoring posts
  let personId: string;
  try {
    const profileRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      return NextResponse.redirect(`${base}/?li=profile_error`);
    }

    const profile = await profileRes.json() as { id: string };
    personId = profile.id;
  } catch (e) {
    console.error("LinkedIn profile fetch threw:", e);
    return NextResponse.redirect(`${base}/?li=profile_error`);
  }

  // Persist tokens
  await prisma.linkedInAuth.upsert({
    where: { id: "singleton" },
    update: {
      accessToken: tokenData.access_token,
      personId,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      ...(tokenData.refresh_token ? { refreshToken: tokenData.refresh_token } : {}),
    },
    create: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      personId,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  });

  await prisma.activity.create({
    data: { action: "LinkedIn account connected", detail: `Person ID: ${personId}`, icon: "🔗" },
  });

  return NextResponse.redirect(`${base}/?li=connected`);
}
