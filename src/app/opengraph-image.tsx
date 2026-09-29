import { ImageResponse } from "next/og";

// 링크 공유 썸네일(카톡·슬랙 등). 링크 공유가 이 서비스의 핵심 동선이라 실제로 자주 노출된다.
// 글자는 넣지 않는다 — next/og 기본 폰트는 Regular만 있어 헤더의 Geist Bold와 어긋나고
// 한글은 렌더되지 않는다. 플랫폼이 이미지 옆에 og:title을 함께 보여주므로 이름은 그쪽이 맡는다.
//
// 기하는 docs/logo/logo.svg(786x450)를 0.72배한 값이다. 마크 폭(566px)을 캔버스 높이(630px)
// 보다 작게 잡아, 썸네일을 정사각으로 잘라 보여주는 플랫폼에서도 마크가 잘리지 않게 했다.
// satori는 SVG보다 div 레이아웃이 안정적이라 도형을 div로 구성했다 — 알약은 borderRadius,
// 겹침은 overflow:hidden으로 만든다.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Meeet - 미팅 시간 맞추기";

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
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        {/* 마크: 786x450 을 0.72배 → 566x324 */}
        <div style={{ position: "relative", display: "flex", width: 566, height: 324 }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 413, height: 79, borderRadius: 40, backgroundColor: BAR }} />
          <div style={{ position: "absolute", left: 60, top: 122, width: 506, height: 79, borderRadius: 40, backgroundColor: BAR }} />
          <div style={{ position: "absolute", left: 156, top: 245, width: 359, height: 79, borderRadius: 40, backgroundColor: BAR }} />

          {/* 앰버 세로 막대. 회색 막대와 겹치는 세 구간만 더 진하게 얹는다. */}
          <div
            style={{
              position: "absolute",
              left: 248,
              top: 0,
              width: 66,
              height: 324,
              borderRadius: 33,
              backgroundColor: AMBER,
              display: "flex",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, width: 66, height: 79, backgroundColor: OVERLAP }} />
            <div style={{ position: "absolute", left: 0, top: 122, width: 66, height: 79, backgroundColor: OVERLAP }} />
            <div style={{ position: "absolute", left: 0, top: 245, width: 66, height: 79, backgroundColor: OVERLAP }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
