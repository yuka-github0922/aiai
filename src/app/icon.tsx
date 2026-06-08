import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 112,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 360,
            height: 360,
            borderRadius: 88,
            background: "rgba(255,255,255,0.92)",
            boxShadow: "4px 4px 0 rgba(244,63,94,0.18)",
          }}
        >
          <div
            style={{
              fontSize: 168,
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
