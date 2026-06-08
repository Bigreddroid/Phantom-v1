import { prisma } from "@/lib/db";
import { getXClientForUser, getXClient, getConvoScraper } from "@/lib/x/client";
import type { Scraper } from "agent-twitter-client";
import { Scraper as ConvoScraper } from "@the-convocation/twitter-scraper";

export interface TelegramCtx {
  botToken: string;
  chatId: string;
  botUrl: string;
}

export interface UserCtx {
  userId: string | null;
  username: string;
  scraperW: Scraper;
  scraperR: ConvoScraper;
  telegram: TelegramCtx;
}

function makeVarunTelegram(): TelegramCtx {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  return { botToken: token, chatId: process.env.TELEGRAM_CHAT_ID!, botUrl: `https://api.telegram.org/bot${token}` };
}

export async function getUserCtx(userId: string | null): Promise<UserCtx> {
  if (!userId) {
    const [scraperW, scraperR] = await Promise.all([getXClient(), getConvoScraper()]);
    return { userId: null, username: process.env.X_USERNAME!, scraperW, scraperR, telegram: makeVarunTelegram() };
  }

  const [cred, tgSetup] = await Promise.all([
    prisma.xCredential.findUnique({ where: { userId } }),
    prisma.telegramSetup.findUnique({ where: { userId } }),
  ]);

  if (!cred) throw new Error(`No X credential for user ${userId}`);
  if (!tgSetup) throw new Error(`No Telegram setup for user ${userId}`);

  const [scraperW, scraperR] = await Promise.all([
    getXClientForUser(userId),
    (async () => {
      const s = new ConvoScraper();
      if (cred.cookies) {
        const cookies = (JSON.parse(cred.cookies) as string[]).map(c =>
          c.replace(/Domain=\.?twitter\.com/gi, "Domain=.x.com")
        );
        await s.setCookies(cookies);
      }
      return s;
    })(),
  ]);

  return {
    userId,
    username: cred.username,
    scraperW,
    scraperR,
    telegram: {
      botToken: tgSetup.botToken,
      chatId: tgSetup.chatId,
      botUrl: `https://api.telegram.org/bot${tgSetup.botToken}`,
    },
  };
}

// Per-user Stats helpers — Varun uses id="singleton", SaaS users use userId as unique key.

export async function getStatsPaused(userId: string | null): Promise<boolean> {
  const row = userId
    ? await prisma.stats.findFirst({ where: { userId }, select: { paused: true } })
    : await prisma.stats.findUnique({ where: { id: "singleton" }, select: { paused: true } });
  return row?.paused ?? false;
}

export async function getStatsRecord(userId: string | null) {
  return userId
    ? prisma.stats.findFirst({ where: { userId } })
    : prisma.stats.findUnique({ where: { id: "singleton" } });
}

export async function upsertStats(userId: string | null, data: Record<string, unknown>) {
  if (userId) {
    return prisma.stats.upsert({
      where: { userId },
      update: data,
      create: { id: userId, userId, ...(data as object) },
    });
  }
  return prisma.stats.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...(data as object) },
  });
}
