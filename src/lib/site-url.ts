// OG 이미지·robots.txt·sitemap.xml은 절대 URL로 나가야 해서 사이트 주소가 필요하다.
// 서버에서만 읽으므로 NEXT_PUBLIC_ 접두사를 붙이지 않는다 — 브라우저는 공유 링크를
// window.location.origin으로 만들기 때문에 이 값이 필요 없다.
// 설정이 없으면 Vercel이 주는 고정 운영 도메인 → 배포별 URL → 로컬 순으로 떨어진다.
// 빈 문자열로 설정된 경우도 "설정 안 함"으로 본다(.env.example이 빈 값으로 두므로).
export const siteUrl =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
