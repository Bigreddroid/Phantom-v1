import { ImageResponse } from "@vercel/og";
import { DISPLAY_INITIAL, X_HANDLE } from "@/lib/config";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("text") ?? "Building in public.";
  // Strip trailing hashtags — they clutter the image
  const text = raw.replace(/(#\w+\s*)+$/, "").trim();

  const len = text.length;
  const fontSize = len < 80 ? 58 : len < 140 ? 50 : len < 220 ? 42 : 36;

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
        {/* Red glow — top-left corner */}
        <div
          style={{
            position: "absolute",
            top: -160,
            left: -160,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,38,38,0.22) 0%, rgba(220,38,38,0.05) 50%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Subtle bottom-right glow */}
        <div
          style={{
            position: "absolute",
            bottom: -120,
            right: -120,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(220,38,38,0.10) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Top accent bar — red gradient */}
        <div
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, #dc2626 0%, #b91c1c 40%, rgba(185,28,28,0.3) 80%, transparent 100%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            padding: "52px 80px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Left red accent + quote text */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              gap: 32,
            }}
          >
            {/* Red left bar */}
            <div
              style={{
                width: 4,
                borderRadius: 2,
                background:
                  "linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)",
                display: "flex",
                flexShrink: 0,
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                gap: 0,
              }}
            >
              {/* Opening quote mark */}
              <div
                style={{
                  color: "#dc2626",
                  fontSize: 72,
                  fontWeight: 900,
                  lineHeight: 0.6,
                  marginBottom: 20,
                  opacity: 0.7,
                  display: "flex",
                }}
              >
                "
              </div>

              {/* Tweet text */}
              <div
                style={{
                  color: "#f9fafb",
                  fontSize,
                  fontWeight: 700,
                  lineHeight: 1.45,
                  letterSpacing: -0.5,
                  display: "flex",
                }}
              >
                {text}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "22px 80px 28px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
              fontWeight: 900,
              marginRight: 16,
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(220,38,38,0.4)",
            }}
          >
            {DISPLAY_INITIAL}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                color: "#f3f4f6",
                fontSize: 19,
                fontWeight: 700,
                display: "flex",
              }}
            >
              {X_HANDLE}
            </div>
            <div
              style={{
                color: "rgba(156,163,175,0.6)",
                fontSize: 14,
                display: "flex",
                letterSpacing: 1,
              }}
            >
              PHANTOM · AI PERSONAL BRAND
            </div>
          </div>

          {/* Right: X mark */}
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
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#dc2626",
                display: "flex",
                boxShadow: "0 0 8px rgba(220,38,38,0.8)",
              }}
            />
            <div
              style={{
                color: "rgba(255,255,255,0.25)",
                fontSize: 36,
                fontWeight: 900,
                display: "flex",
              }}
            >
              𝕏
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1920, height: 1080 }
  );
}
