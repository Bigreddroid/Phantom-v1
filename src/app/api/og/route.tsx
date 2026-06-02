import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") ?? "Building in public.";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#000",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ color: "white", fontSize: 52, fontWeight: 700, lineHeight: 1.3, maxWidth: 900 }}>
          {text}
        </div>
        <div style={{ color: "#555", fontSize: 28, marginTop: 48, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: "white", fontWeight: 600 }}>@BigRedDr0id</div>
          <div>· Building Phantom in public</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
