import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recalculateWarmth } from "@/lib/leads/profile";
import { getICP } from "@/lib/leads/icp";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId") ?? null;

  try {
    const [icp, leads] = await Promise.all([
      getICP(userId),
      prisma.leadProfile.findMany({
        where: { userId, stage: { in: ["DISCOVERED", "WARMING"] } },
        select: { id: true, warmthScore: true, stage: true },
      }),
    ]);

    let promoted = 0;
    let updated = 0;

    for (const lead of leads) {
      const newScore = await recalculateWarmth(lead.id);

      const updates: Record<string, unknown> = { warmthScore: newScore };

      // Promote DISCOVERED → WARMING when score > 0
      if (lead.stage === "DISCOVERED" && newScore > 0) {
        updates.stage = "WARMING";
        promoted++;
      }

      if (newScore !== lead.warmthScore || updates.stage) {
        await prisma.leadProfile.update({ where: { id: lead.id }, data: updates });
        updated++;
      }
    }

    // Also check if any WARMING leads have crossed the DM threshold (for logging only — lead-dm cron fires DMs)
    const dmReady = leads.filter(l => l.stage === "WARMING" && l.warmthScore >= icp.warmthThreshold).length;

    return NextResponse.json({ ok: true, updated, promoted, dmReady });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
