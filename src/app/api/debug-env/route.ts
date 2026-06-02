import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.X_API_KEY ?? "";
  const secret = process.env.X_API_SECRET ?? "";
  const token = process.env.X_ACCESS_TOKEN ?? "";
  const tokenSecret = process.env.X_ACCESS_TOKEN_SECRET ?? "";

  return NextResponse.json({
    X_API_KEY: { len: key.length, first: key.charCodeAt(0), preview: key.slice(0, 6) },
    X_API_SECRET: { len: secret.length, first: secret.charCodeAt(0), preview: secret.slice(0, 6) },
    X_ACCESS_TOKEN: { len: token.length, first: token.charCodeAt(0), preview: token.slice(0, 6) },
    X_ACCESS_TOKEN_SECRET: { len: tokenSecret.length, first: tokenSecret.charCodeAt(0), preview: tokenSecret.slice(0, 6) },
    CRON_SECRET: { len: (process.env.CRON_SECRET ?? "").length, first: (process.env.CRON_SECRET ?? "").charCodeAt(0) },
  });
}
