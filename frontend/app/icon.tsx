import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          background: "#0b1220",
          borderRadius: "8px",
          color: "white",
          fontSize: 14,
          fontWeight: 1000,
          letterSpacing: 0.6,
          lineHeight: 1,
        }}
      >
        <span
          style={{
            display: "block",
            transform: "translate(0.5px, 0.5px)",
            textShadow: "0 0 1px rgba(255, 255, 255, 0.5)",
          }}
        >
          TAX
        </span>
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  );
}
