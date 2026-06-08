import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEMO, DEMO_ACTIVITY } from "@/lib/demo-data";

export async function GET(req: NextRequest) {
  if (DEMO) return NextResponse.json(DEMO_ACTIVITY);

  const userId = req.headers.get("x-phantom-user-id") ?? null;
  const userFilter = userId ? { userId } : { userId: null };

  const activity = await prisma.activity.findMany({
    where: userFilter,
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(activity);
}
