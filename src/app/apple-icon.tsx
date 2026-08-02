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
          background: "#08090b",
        }}
      >
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 999,
            background: "#3ddc97",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
