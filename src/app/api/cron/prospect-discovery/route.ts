import { NextResponse } from "next/server";
import { getICP } from "@/lib/leads/icp";
import { upsertLead } from "@/lib/leads/profile";
import { getUserCtx } from "@/lib/user-context";
import { sendMessage } from "@/lib/telegram/notify";
import { ConvoSearchMode } from "@/lib/x/client";

export const maxDuration = 60;

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

    const { keywords, minFollowers, maxFollowers } = icp;
    if (!keywords.length) {
      return NextResponse.json({ skipped: true, reason: "no ICP keywords configured" });
    }

    // Pick 2 random keywords this run for variety
    const shuffled = [...keywords].sort(() => Math.random() - 0.5);
    const activeKeywords = shuffled.slice(0, 2);

    let discovered = 0;
    const errors: string[] = [];

    for (const keyword of activeKeywords) {
      try {
        const results: Array<{ id: string; text: string; userId?: string; username?: string; userBio?: string }> = [];
        for await (const t of ctx.scraperR.searchTweets(
          `${keyword} -is:retweet lang:en`,
          15,
          ConvoSearchMode.Latest,
        )) {
          if (t.userId && t.username) results.push({
            id: t.id ?? "",
            text: t.text ?? "",
            userId: t.userId,
            username: t.username,
          });
          if (results.length >= 15) break;
        }

        for (const result of results) {
          if (!result.userId || !result.username) continue;

          // Fetch profile to get bio + follower count
          try {
            const profile = await ctx.scraperR.getProfile(result.username);
            const followersCount = profile?.followersCount ?? 0;

            if (followersCount < minFollowers || followersCount > maxFollowers) continue;

            const bio = profile?.biography ?? "";
            const recentTweets = [result.text];

            const { isNew } = await upsertLead(
              userId,
              result.userId,
              result.username,
              bio,
              recentTweets,
              keyword,
            );

            if (isNew) discovered++;
          } catch {
            // Profile fetch failures are non-fatal — skip this prospect
          }
        }
      } catch (e) {
        errors.push(`${keyword}: ${String(e).slice(0, 60)}`);
      }
    }

    if (discovered > 0) {
      await sendMessage(
        `🔍 *Prospect Discovery*\n\n` +
        `Found ${discovered} new lead${discovered !== 1 ? "s" : ""} via: ${activeKeywords.join(", ")}`,
        ctx.telegram
      );
    }

    return NextResponse.json({ ok: true, discovered, keywords: activeKeywords, errors });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
