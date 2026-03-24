import { ImageResponse } from "next/og";

export const alt = "life OS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default async function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "56px 64px",
        background:
          "radial-gradient(circle at top right, rgba(6,182,212,0.25), transparent 40%), radial-gradient(circle at bottom left, rgba(16,185,129,0.2), transparent 35%), #09090b",
        color: "#fff",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: "rgba(228,228,231,0.9)",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        carbon&apos;s system
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-0.04em",
            color: "#ffffff",
          }}
        >
          life operating system
        </div>
        <div
          style={{
            fontSize: 34,
            color: "rgba(228,228,231,0.82)",
          }}
        >
          align vision, goals, projects, and daily focus
          in one system
        </div>
      </div>
      <div
        style={{
          fontSize: 26,
          color: "rgba(161,161,170,0.9)",
        }}
      >
        makesomething.so
      </div>
    </div>,
    { ...size },
  );
}
