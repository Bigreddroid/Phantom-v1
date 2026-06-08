import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getICP } from "@/lib/leads/icp";
import { appendDmHistory, logLeadActivity } from "@/lib/leads/profile";
import { generateDM } from "@/lib/claude/generate";
import { sendDM } from "@/lib/x/dm";
import { getUserCtx } from "@/lib/user-context";
import { sendMessage } from "@/lib/telegram/notify";
import { humanPause, randomDelay } from "@/lib/scheduler/humanize";

export const maxDuration = 60;

const MAX_DMS_PER_RUN = 3;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId") ?? null;

  try {
    const [icp, ctx] = await Promise.all([
      getICP(userId),
      getUserCtx(userId),
    ]);

    // Find warm leads that haven't been DM'd yet, ordered by warmth score desc
    const leads = await prisma.leadProfile.findMany({
      where: {
        userId,
        stage: "WARMING",
        warmthScore: { gte: icp.warmthThreshold },
      },
      orderBy: { warmthScore: "desc" },
      take: MAX_DMS_PER_RUN,
    });

    if (!leads.length) {
      return NextResponse.json({ ok: true, skipped: true, reason: "no warm leads above threshold" });
    }

    const sent: string[] = [];
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        await humanPause();

        // Build rich context for DM generation: aiSummary + recent activity signals
        const recentActivities = await prisma.leadActivity.findMany({
          where: { leadId: lead.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        const signals = recentActivities.map(a => a.type.replace(/_/g, " ")).join(", ");
        const context = [
          lead.aiSummary ?? `@${lead.username}`,
          signals ? `Recent signals: ${signals}` : "",
          lead.bio ? `Bio: ${lead.bio.slice(0, 150)}` : "",
        ].filter(Boolean).join(". ");

        const dmText = await generateDM(lead.username, context);

        // Resolve twitterUserId to send DM
        await sendDM(lead.twitterUserId, dmText, {
          wClient: ctx.scraperW,
          myUserId: userId
            ? (await prisma.xCredential.findUnique({ where: { userId }, select: { xUserId: true } }))?.xUserId ?? undefined
            : process.env.X_USER_ID,
        });

        // Log to dmHistory + activity
        await appendDmHistory(lead.id, { sent: dmText, at: new Date().toISOString() });
        await logLeadActivity(lead.id, "dm_sent", dmText.slice(0, 100));

        // Promote to DM_SENT stage
        await prisma.leadProfile.update({
          where: { id: lead.id },
          data: { stage: "DM_SENT" },
        });

        await prisma.activity.create({
          data: { userId, action: `Lead DM sent to @${lead.username}`, detail: dmText.slice(0, 80), icon: "📩" },
        });

        await sendMessage(
          `📩 *Lead DM sent*\n\n` +
          `@${lead.username} · warmth ${lead.warmthScore}\n\n` +
          `_"${dmText.slice(0, 200)}"_`,
          ctx.telegram
        );

        sent.push(lead.username);
        await randomDelay(5000, 10000);
      } catch (e) {
        errors.push(`@${lead.username}: ${String(e).slice(0, 80)}`);
      }
    }

    return NextResponse.json({ ok: true, sent, errors });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
