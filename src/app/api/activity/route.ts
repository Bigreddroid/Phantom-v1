import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEMO, DEMO_ACTIVITY } from "@/lib/demo-data";

export async function GET() {
  if (DEMO) return NextResponse.json(DEMO_ACTIVITY);

  const activity = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(activity);
}
