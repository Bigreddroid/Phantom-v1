import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";

// Self-healing: if no activity in 90 minutes, fire engage + mentions
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
