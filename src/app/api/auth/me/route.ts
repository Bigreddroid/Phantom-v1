import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserWithSetup } from "@/lib/auth/user";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await getUserWithSetup(session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id:                user.id,
    email:             user.email,
    name:              user.name,
    plan:              user.plan,
    subscriptionStatus: user.subscriptionStatus,
    onboardingDone:    user.onboardingDone,
    onboardingStep:    user.onboardingStep,
    hasX:              !!user.xCredential,
    hasTelegram:       !!user.telegramSetup,
    hasSettings:       !!user.userSettings,
    xHandle:           user.xCredential?.username ?? null,
    telegramChatId:    user.telegramSetup?.chatId ?? null,
  });
}
