import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "./components/analytics";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

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
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
