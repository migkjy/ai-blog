import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "AI AppPro 블로그";
  const description = searchParams.get("description") || "실전 AI 활용 가이드";
  const category = searchParams.get("category") || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {category && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                background: "rgba(59,130,246,0.3)",
                border: "1px solid rgba(59,130,246,0.5)",
                padding: "6px 16px",
                borderRadius: "20px",
                fontSize: "20px",
                fontWeight: 600,
                color: "#93c5fd",
              }}
            >
              {category}
            </span>
          </div>
        )}
        <div
          style={{
            fontSize: title.length > 30 ? "48px" : "56px",
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: "20px",
            maxWidth: "900px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "24px",
            opacity: 0.7,
            lineHeight: 1.5,
            maxWidth: "800px",
          }}
        >
          {description.length > 100 ? description.slice(0, 100) + "..." : description}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: "40px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              opacity: 0.9,
            }}
          >
            AI AppPro
          </div>
          <div
            style={{
              marginLeft: "16px",
              fontSize: "20px",
              opacity: 0.5,
            }}
          >
            블로그
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
