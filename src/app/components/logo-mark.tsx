// 로고 마크(가로형). 기하는 docs/logo/logo.svg가 원본이며 여기 값은 그 사본이다.
// 세 사람의 가능 시간대(회색 막대)가 겹치는 구간을 앰버 세로 막대가 가리킨다.
// 겹침색 #dc8f0a는 gray-200 x amber-500의 multiply를 미리 계산한 값이다
// (blend-mode를 쓰지 않아 어떤 렌더러에서도 같게 보인다).
// label이 없으면 장식으로 간주해 스크린리더에서 숨긴다 — 헤더처럼 "Meeet" 글자와
// 나란히 쓸 때 이름이 두 번 읽히는 것을 막는다. 마크만 단독으로 쓸 때는 label을 준다.
export function LogoMark({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 786 450"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        <clipPath id="meeet-mark-band">
          <rect x="345" y="0" width="92" height="450" rx="46" />
        </clipPath>
      </defs>

      <g fill="#e5e7eb">
        <rect x="0" y="0" width="574" height="110" rx="55" />
        <rect x="83" y="170" width="703" height="110" rx="55" />
        <rect x="216" y="340" width="498" height="110" rx="55" />
      </g>

      <rect x="345" y="0" width="92" height="450" rx="46" fill="#f59e0b" />

      <g fill="#dc8f0a" clipPath="url(#meeet-mark-band)">
        <rect x="345" y="0" width="92" height="110" />
        <rect x="345" y="170" width="92" height="110" />
        <rect x="345" y="340" width="92" height="110" />
      </g>
    </svg>
  );
}
