import { prisma } from "@/lib/db";

const DEFAULT_ICP = {
  keywords: ["building in public", "solopreneur", "personal brand", "AI tools", "indie hacker", "solo founder"],
  competitorHandles: [] as string[],
  hashtags: ["buildinpublic", "solopreneur", "indiemaker"],
  minFollowers: 500,
  maxFollowers: 100000,
  warmthThreshold: 60,
};

export async function getICP(userId: string | null) {
  const row = await prisma.iCPConfig.findFirst({ where: { userId } });
  return row ?? { ...DEFAULT_ICP, id: null, userId, createdAt: new Date(), updatedAt: new Date() };
}

export async function upsertICP(userId: string | null, data: Partial<typeof DEFAULT_ICP>) {
  const existing = await prisma.iCPConfig.findFirst({ where: { userId } });
  if (existing) {
    return prisma.iCPConfig.update({ where: { id: existing.id }, data });
  }
  return prisma.iCPConfig.create({
    data: { userId, ...DEFAULT_ICP, ...data },
  });
}
