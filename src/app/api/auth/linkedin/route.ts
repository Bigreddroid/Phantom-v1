import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  if (!process.env.LINKEDIN_CLIENT_ID) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?li=needs_setup`);
  }

  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set("li_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/linkedin/callback`,
    state,
    scope: "openid profile email w_member_social",
  });

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params}`
  );
}
