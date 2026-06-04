import { ImageResponse } from "@vercel/og";
import { DISPLAY_INITIAL, X_HANDLE } from "@/lib/config";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("text") ?? "Building in public.";

  // Strip trailing hashtags — they clutter the card
  const text = raw.replace(/(#\w+\s*)+$/, "").trim();

  // Scale font down gracefully for longer text
  const len = text.length;
  const fontSize = len < 60 ? 56 : len < 100 ? 48 : len < 160 ? 42 : len < 220 ? 36 : 30;
  const paddingV = len > 160 ? 40 : 52;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top red gradient bar */}
        <div
          style={{
            height: 4,
            width: "100%",
            background:
              "linear-gradient(90deg, #dc2626 0%, #b91c1c 45%, rgba(185,28,28,0.25) 80%, transparent 100%)",
            display: "flex",
            flexShrink: 0,
          }}
        />

        {/* Background glow — top left */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: -180,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,38,38,0.18) 0%, rgba(220,38,38,0.04) 55%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Background glow — bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: -120,
            right: -80,
            width: 340,
            height: 340,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: `${paddingV}px 80px ${paddingV - 8}px`,
          }}
        >
          {/* Red left border + quote block */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              gap: 28,
              width: "100%",
            }}
          >
            {/* Vertical red accent */}
            <div
              style={{
                width: 5,
                borderRadius: 3,
                background: "linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)",
                display: "flex",
                flexShrink: 0,
              }}
            />

            {/* Quote + text column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
                gap: 12,
              }}
            >
              {/* Opening quote */}
              <div
                style={{
                  color: "rgba(220,38,38,0.65)",
                  fontSize: 80,
                  fontWeight: 900,
                  lineHeight: 0.5,
                  display: "flex",
                }}
              >
                {"“"}
              </div>

              {/* Tweet text — flex column ensures wrapping */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  color: "#f3f4f6",
                  fontSize,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  letterSpacing: -0.3,
                  wordBreak: "break-word",
                  maxWidth: "100%",
                }}
              >
                {text}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar — author + branding */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            padding: "20px 80px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 900,
              flexShrink: 0,
              marginRight: 16,
              boxShadow: "0 0 18px rgba(220,38,38,0.45)",
            }}
          >
            {DISPLAY_INITIAL}
          </div>

          {/* Name + label */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div
              style={{
                color: "#f9fafb",
                fontSize: 20,
                fontWeight: 700,
                display: "flex",
              }}
            >
              {X_HANDLE}
            </div>
            <div
              style={{
                color: "rgba(156,163,175,0.55)",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 1.2,
                display: "flex",
              }}
            >
              PHANTOM · AI PERSONAL BRAND
            </div>
          </div>

          {/* Right — X logo */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#dc2626",
                display: "flex",
                boxShadow: "0 0 10px rgba(220,38,38,0.9)",
              }}
            />
            <div
              style={{
                color: "rgba(255,255,255,0.18)",
                fontSize: 38,
                fontWeight: 900,
                display: "flex",
              }}
            >
              {"𝕏"}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 628 }
  );
}
