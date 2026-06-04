import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/notify";
import { Resend } from "resend";

const FROM = "Phantom <onboarding@resend.dev>";
const REPLY_TO = "bigreddroid7@gmail.com";

function confirmationEmail(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the Phantom waitlist</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

          <!-- Top red bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#dc2626,#7f1d1d,transparent);font-size:0;">&nbsp;</td>
          </tr>

          <!-- Logo + header -->
          <tr>
            <td style="padding:40px 40px 32px;text-align:center;">
              <div style="display:inline-block;width:52px;height:52px;background:linear-gradient(135deg,#dc2626,#7f1d1d);border-radius:14px;margin-bottom:20px;">
                <table width="52" height="52" cellpadding="0" cellspacing="0">
                  <tr><td align="center" valign="middle" style="color:#fff;font-size:24px;font-weight:900;">P</td></tr>
                </table>
              </div>
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f9fafb;letter-spacing:-0.5px;">You&rsquo;re on the list.</h1>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.4);line-height:1.6;">
                We&rsquo;ll reach out to <span style="color:rgba(255,255,255,0.65);">${email}</span> when access opens.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="height:1px;background:rgba(255,255,255,0.06);font-size:0;">&nbsp;</td></tr>

          <!-- What is Phantom -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.25);">What you&rsquo;re getting access to</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ["𝕏", "X/Twitter on autopilot", "Tweets, threads, replies, follows, DMs — all AI-generated in your voice, 96 actions/day."],
                  ["💼", "LinkedIn handled too", "Thought leadership, stories, numbered lists — posted 4×/week without you touching it."],
                  ["📱", "Telegram control center", "Approve, regenerate, or skip everything from your phone. One tap to post or skip."],
                  ["🧠", "Sounds like you", "Claude generates every post in your voice. Not a bot. Not a template. Actually you."],
                ].map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:0 0 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;vertical-align:top;padding-top:2px;">
                          <div style="width:32px;height:32px;background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.2);border-radius:8px;text-align:center;line-height:32px;font-size:15px;">${icon}</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#f3f4f6;">${title}</p>
                          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.38);line-height:1.5;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="height:1px;background:rgba(255,255,255,0.06);font-size:0;">&nbsp;</td></tr>

          <!-- Self-host CTA -->
          <tr>
            <td style="padding:28px 40px;text-align:center;">
              <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.6;">
                Can&rsquo;t wait? The repo is open source — you can self-host today.
              </p>
              <a href="https://github.com/Bigreddroid/Phantom-v1"
                 style="display:inline-block;padding:11px 24px;background:#dc2626;color:#fff;font-size:13px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                View on GitHub →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.18);line-height:1.6;">
                Phantom · Built by <a href="https://x.com/BigRedDr0id" style="color:rgba(220,38,38,0.6);text-decoration:none;">@BigRedDr0id</a> under BigRedDroid<br/>
                You signed up at phantom-beige.vercel.app
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
    void entry;

    // Fire both in parallel — neither blocks the response, failures are swallowed
    void Promise.all([
      sendMessage(`🚀 *New Phantom waitlist signup*\n\n📧 ${email}\n👥 Total: ${count}`),
      process.env.RESEND_API_KEY
        ? new Resend(process.env.RESEND_API_KEY).emails.send({
            from: FROM,
            replyTo: REPLY_TO,
            to: email,
            subject: "You're on the Phantom waitlist",
            html: confirmationEmail(email),
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
