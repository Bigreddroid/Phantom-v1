import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") ?? "Building in public.";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #000000 0%, #0d0d0d 60%, #111827 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 80px 56px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Accent bar */}
        <div style={{ display: "flex", marginBottom: 40 }}>
          <div style={{ width: 48, height: 4, background: "#1d9bf0", borderRadius: 2 }} />
        </div>

        {/* Tweet text */}
        <div
          style={{
            color: "#ffffff",
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.35,
            flex: 1,
            wordBreak: "break-word",
            width: "100%",
            display: "flex",
            alignItems: "center",
          }}
        >
          {text}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
            paddingTop: 28,
            borderTop: "1px solid #1f2937",
            width: "100%",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1d9bf0 0%, #0052cc 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
              fontWeight: 800,
              marginRight: 16,
              flexShrink: 0,
            }}
          >
            V
          </div>

          {/* Name + handle */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#6b7280", fontSize: 18, lineHeight: 1.2 }}>
              {process.env.X_HANDLE ?? "@BigRedDr0id"}
            </div>
          </div>

          {/* X logo */}
          <div
            style={{
              marginLeft: "auto",
              color: "#374151",
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: -2,
            }}
          >
            𝕏
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
