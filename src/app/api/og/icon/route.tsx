import { ImageResponse } from "next/og";

export async function GET() {
  try {
    return new ImageResponse(
      <div
        style={{
          width: "512px",
          height: "512px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "5rem",
          background: "linear-gradient(to bottom, #7f22fe, #6a20c5, #551ea2, #401c7a, #2c1a49)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          viewBox="-8 -8 40 40"
          fill="none"
          stroke="#e0d4ff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: "drop-shadow(0px 5px 6px black) drop-shadow(0px 4px 10px black)",
          }}
        >
          <path d="M12 6V2H8" />
          <path d="m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z" />
          <path d="M2 12h2" />
          <path d="M9 11v2" />
          <path d="M15 11v2" />
          <path d="M20 12h2" />
        </svg>
      </div>,
      { width: 512, height: 512 },
    );
  } catch (error) {
    console.log(error);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
