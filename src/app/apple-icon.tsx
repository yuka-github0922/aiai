import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #fef3f2 0%, #faf5ff 65%, #ffffff 100%)",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 128,
            height: 128,
            borderRadius: 32,
            background: "rgba(255,255,255,0.92)",
            boxShadow: "3px 3px 0 rgba(244,63,94,0.18)",
          }}
        >
          <div
            style={{
              fontSize: 64,
              color: "#f43f5e",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 900,
              fontStyle: "italic",
              letterSpacing: "-0.05em",
            }}
          >
            A
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
