import { ImageResponse } from "next/og";

// iOS 홈 화면 아이콘. 투명 배경을 지원하지 않으므로 흰 배경을 깔아준다.
// 기하는 icon.svg(정사각 압축본, viewBox 64)를 180/64 = 2.8125배한 값이다.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BAR = "#e5e7eb";
const AMBER = "#f59e0b";
const OVERLAP = "#dc8f0a"; // BAR x AMBER multiply 선계산값

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ position: "absolute", left: 14, top: 20, width: 107, height: 34, borderRadius: 17, backgroundColor: BAR }} />
        <div style={{ position: "absolute", left: 31, top: 73, width: 135, height: 34, borderRadius: 17, backgroundColor: BAR }} />
        <div style={{ position: "absolute", left: 48, top: 127, width: 96, height: 34, borderRadius: 17, backgroundColor: BAR }} />

        <div
          style={{
            position: "absolute",
            left: 73,
            top: 20,
            width: 34,
            height: 141,
            borderRadius: 17,
            backgroundColor: AMBER,
            display: "flex",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, width: 34, height: 34, backgroundColor: OVERLAP }} />
          <div style={{ position: "absolute", left: 0, top: 53, width: 34, height: 34, backgroundColor: OVERLAP }} />
          <div style={{ position: "absolute", left: 0, top: 107, width: 34, height: 34, backgroundColor: OVERLAP }} />
        </div>
      </div>
    ),
    size,
  );
}
