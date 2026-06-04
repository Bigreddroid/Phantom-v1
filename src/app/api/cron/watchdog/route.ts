import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { ensureWebhook, ensureCommands } from "@/lib/telegram/setup";
import { getMyProfile } from "@/lib/x/engage";

// Self-healing: if no activity in 90 minutes, fire engage + mentions
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  void ensureWebhook();  // re-registers webhook if missing or stale
  void ensureCommands(); // keeps bot / menu in sync

  // ── X auth health check ──────────────────────────────────────────────────────
  try {
    await getMyProfile();
  } catch (e) {
    const msg = String(e);
    if (msg.includes("401") || msg.includes("403") || msg.includes("auth") || msg.includes("login")) {
      await sendMessage(
        `🔑 *X auth failing* — cookies may be expired.\n\n` +
        `Run \`node get-cookies.js\` to refresh, then redeploy:\n` +
        "`npx vercel deploy --prod`"
      );
    }
  }

  // ── Cookie staleness check ───────────────────────────────────────────────────
  // Warn if XSession hasn't been updated in 25+ days (X cookies expire ~30 days)
  const session = await prisma.xSession.findUnique({ where: { id: "singleton" } });
  if (session?.updatedAt) {
    const daysSince = (Date.now() - session.updatedAt.getTime()) / 86400000;
    if (daysSince >= 25) {
      await sendMessage(
        `⏰ *Cookie refresh due* — session is ${Math.floor(daysSince)} days old (expires ~30 days).\n\n` +
        `Refresh now:\n` +
        `1. Stop Brave\n` +
        `2. \`node get-cookies.js\`\n` +
        `3. \`npx vercel deploy --prod\``
      );
    }
  }

  const cutoff = new Date(Date.now() - 90 * 60 * 1000);
  const recent = await prisma.activity.findFirst({
    where: { createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
  });

  if (recent) {
    return NextResponse.json({ ok: true, status: "active", last: recent.createdAt });
  }

  // No activity in 90 min — wake everything up
  const base = process.env.NEXTAUTH_URL!;
  const headers = { "Authorization": `Bearer ${process.env.CRON_SECRET}` };

  await Promise.allSettled([
    fetch(`${base}/api/cron/engage`, { headers }),
    fetch(`${base}/api/cron/mentions`, { headers }),
  ]);

  await sendMessage(`⚠️ *Watchdog fired* — no activity for 90 min. Engagement + mentions restarted.`);

  return NextResponse.json({ ok: true, status: "restarted" });
}
