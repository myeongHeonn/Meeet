import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Meeet — 미팅 시간 맞추기";
const DESCRIPTION =
  "여러 명의 미팅 시간을 빠르게 정하세요. 가입 없이 바로 만들고 공유하세요.";

// OG 이미지(opengraph-image.tsx)는 절대 URL로 나가야 해서 사이트 주소가 필요하다.
// 서버에서만 읽으므로 NEXT_PUBLIC_ 접두사를 붙이지 않는다 — 브라우저는 공유 링크를
// window.location.origin으로 만들기 때문에 이 값이 필요 없다.
// 설정이 없으면 Vercel이 주는 고정 운영 도메인 → 배포별 URL → 로컬 순으로 떨어진다.
// 빈 문자열로 설정된 경우도 "설정 안 함"으로 본다(.env.example이 빈 값으로 두므로).
const siteUrl =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  // 이미지는 지정하지 않는다 — opengraph-image.tsx가 파일 규약이라 Next가 자동으로 붙인다.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Meeet",
    locale: "ko_KR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900">{children}</body>
    </html>
  );
}
