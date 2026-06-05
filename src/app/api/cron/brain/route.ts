import { NextResponse } from "next/server";
import { analyzePerformance } from "@/lib/brain/performance";
import { sendMessage } from "@/lib/telegram/notify";

export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { insights, diff } = await analyzePerformance();

    if (insights.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "not enough activity data" });
    }

    const insightLines = insights.map(i => `• ${i}`).join("\n");
    const diffLine = diff.length > 0
      ? `\n\n_Brain fields auto-updated: ${diff.join(", ")}_`
      : "\n\n_No brain fields changed — strategy is aligned._";

    await sendMessage(
      `🧠 *Weekly Brain Analysis*\n\n` +
      `_Opus extended thinking ran on last 30 days of data._\n\n` +
      insightLines +
      diffLine
    );

    return NextResponse.json({ ok: true, insights, diff });
  } catch (e) {
    await sendMessage(`⚠️ Brain analysis failed: ${String(e).slice(0, 100)}`);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
