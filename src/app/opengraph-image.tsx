import { ImageResponse } from "next/og";

// 링크 공유 썸네일(카톡·슬랙 등). 링크 공유가 이 서비스의 핵심 동선이라 실제로 자주 노출된다.
// 기하는 docs/logo/logo.svg(786x450)를 0.5배한 값이다. satori는 SVG보다 div 레이아웃이
// 안정적이라 도형을 div로 구성했다 — 알약은 borderRadius, 겹침은 overflow:hidden으로 만든다.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Meeet — 미팅 시간 맞추기";

const BAR = "#e5e7eb";
const AMBER = "#f59e0b";
const OVERLAP = "#dc8f0a"; // BAR x AMBER multiply 선계산값

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        {/* 마크: 786x450 을 0.5배 → 393x225 */}
        <div style={{ position: "relative", display: "flex", width: 393, height: 225 }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 287, height: 55, borderRadius: 28, backgroundColor: BAR }} />
          <div style={{ position: "absolute", left: 42, top: 85, width: 352, height: 55, borderRadius: 28, backgroundColor: BAR }} />
          <div style={{ position: "absolute", left: 108, top: 170, width: 249, height: 55, borderRadius: 28, backgroundColor: BAR }} />

          {/* 앰버 세로 막대. 회색 막대와 겹치는 세 구간만 더 진하게 얹는다. */}
          <div
            style={{
              position: "absolute",
              left: 173,
              top: 0,
              width: 46,
              height: 225,
              borderRadius: 23,
              backgroundColor: AMBER,
              display: "flex",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, width: 46, height: 55, backgroundColor: OVERLAP }} />
            <div style={{ position: "absolute", left: 0, top: 85, width: 46, height: 55, backgroundColor: OVERLAP }} />
            <div style={{ position: "absolute", left: 0, top: 170, width: 46, height: 55, backgroundColor: OVERLAP }} />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#0a0a0a",
          }}
        >
          Meeet
        </div>
      </div>
    ),
    size,
  );
}
