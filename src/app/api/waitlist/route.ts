import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email || !email.includes("@") || !email.includes(".")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const existing = await prisma.waitlist.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: true, existing: true });
    }

    const [entry, count] = await Promise.all([
      prisma.waitlist.create({ data: { email } }),
      prisma.waitlist.count(),
    ]);

    void sendMessage(`🚀 *New Phantom waitlist signup*\n\n📧 ${email}\n👥 Total: ${count}`);
    void entry;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
