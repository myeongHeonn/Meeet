import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// 검색에 노출할 공개 페이지는 홈 하나뿐이다. 폴 페이지는 토큰이 권한이라 싣지 않는다.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl, changeFrequency: "monthly", priority: 1 }];
}
