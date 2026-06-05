import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

// GET — return onboarding state for current user
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { xCredential: true, telegramSetup: true, userSettings: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    step:          user.onboardingStep,
    done:          user.onboardingDone,
    hasX:          !!user.xCredential,
    hasTelegram:   !!user.telegramSetup,
    hasSettings:   !!user.userSettings,
    xHandle:       user.xCredential?.username ?? "",
    telegramChatId: user.telegramSetup?.chatId ?? "",
    settings:      user.userSettings ?? null,
  });
}

// POST — save a step
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const { step } = body;

  try {
    if (step === "x") {
      const { authMethod = "cookies", username } = body as { authMethod?: string; username: string };
      if (!username) return NextResponse.json({ error: "username is required" }, { status: 400 });
      const handle = (username as string).replace("@", "");

      if (authMethod === "api") {
        // Official X API key flow
        const { apiKey, apiSecret, accessToken, accessSecret } =
          body as { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string };
        if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
          return NextResponse.json({ error: "All four API key fields are required" }, { status: 400 });
        }

        // Validate credentials live — call /2/users/me
        let xUserId: string | undefined;
        try {
          const { TwitterApi } = await import("twitter-api-v2");
          const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
          const me = await client.v2.me({ "user.fields": ["id", "username"] });
          xUserId = me.data.id;
        } catch {
          return NextResponse.json({ error: "API credentials rejected by X — check your keys and token permissions" }, { status: 400 });
        }

        await prisma.xCredential.upsert({
          where: { userId: session.userId },
          update: { authMethod: "api", cookies: null, username: handle, xUserId, apiKey, apiSecret, accessToken, accessSecret },
          create: { userId: session.userId, authMethod: "api", username: handle, xUserId, apiKey, apiSecret, accessToken, accessSecret },
        });
      } else {
        // Cookie flow (default)
        const { cookies } = body as { cookies: string };
        if (!cookies) return NextResponse.json({ error: "cookies are required for cookie-based auth" }, { status: 400 });
        try { JSON.parse(cookies); } catch {
          return NextResponse.json({ error: "cookies must be valid JSON array" }, { status: 400 });
        }

        await prisma.xCredential.upsert({
          where: { userId: session.userId },
          update: { authMethod: "cookies", cookies, username: handle, apiKey: null, apiSecret: null, accessToken: null, accessSecret: null },
          create: { userId: session.userId, authMethod: "cookies", cookies, username: handle },
        });
      }

      await prisma.user.update({
        where: { id: session.userId },
        data: { onboardingStep: Math.max(1, (await prisma.user.findUnique({ where: { id: session.userId }, select: { onboardingStep: true } }))?.onboardingStep ?? 0) },
      });
      return NextResponse.json({ ok: true });
    }

    if (step === "telegram") {
      // Step 2: Telegram bot token + chat ID
      const { botToken, chatId } = body as { botToken: string; chatId: string };
      if (!botToken || !chatId) return NextResponse.json({ error: "botToken and chatId required" }, { status: 400 });

      // Validate Telegram bot token by hitting getMe
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`).catch(() => null);
      if (!meRes?.ok) return NextResponse.json({ error: "Invalid bot token — check @BotFather" }, { status: 400 });
      const meData = await meRes.json() as { ok: boolean; result?: { username?: string } };
      if (!meData.ok) return NextResponse.json({ error: "Telegram API rejected the token" }, { status: 400 });

      await prisma.telegramSetup.upsert({
        where: { userId: session.userId },
        update: { botToken, chatId },
        create: { userId: session.userId, botToken, chatId },
      });

      // Register webhook for this user's bot
      const webhookUrl = `${process.env.NEXTAUTH_URL}/api/telegram?userId=${session.userId}`;
      const whRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
      }).catch(() => null);
      const webhookSet = whRes?.ok ?? false;

      await prisma.telegramSetup.update({
        where: { userId: session.userId },
        data: { webhookSet },
      });
      await prisma.user.update({
        where: { id: session.userId },
        data: { onboardingStep: Math.max(2, (await prisma.user.findUnique({ where: { id: session.userId }, select: { onboardingStep: true } }))?.onboardingStep ?? 0) },
      });
      return NextResponse.json({ ok: true, botName: meData.result?.username, webhookSet });
    }

    if (step === "settings") {
      // Step 3: voice + niche settings
      const { handle, nicheKeywords, contentTopics, threadTopics, voiceTopics, voiceDescription } =
        body as Record<string, string>;

      await prisma.userSettings.upsert({
        where: { userId: session.userId },
        update: { handle: handle ?? "", nicheKeywords: nicheKeywords ?? "", contentTopics: contentTopics ?? "", threadTopics: threadTopics ?? "", voiceTopics: voiceTopics ?? "", voiceDescription: voiceDescription ?? "" },
        create: { userId: session.userId, handle: handle ?? "", nicheKeywords: nicheKeywords ?? "", contentTopics: contentTopics ?? "", threadTopics: threadTopics ?? "", voiceTopics: voiceTopics ?? "", voiceDescription: voiceDescription ?? "" },
      });

      // Mark onboarding complete
      await prisma.user.update({
        where: { id: session.userId },
        data: { onboardingStep: 4, onboardingDone: true },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
