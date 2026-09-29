import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  // 미리보기 배포(dev 등)는 검색에 노출되지 않게 전부 막는다 — 운영과 중복 색인 방지.
  if (process.env.VERCEL_ENV === "preview") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  // 폴 페이지(/p/*)는 막지 않는다 — 크롤러가 페이지를 읽어야 noindex를 보고 색인에서 뺀다.
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
