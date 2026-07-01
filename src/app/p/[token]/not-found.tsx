"use client";

import { useEffect } from "react";
import Link from "next/link";

// 없는/만료된 폴에 접근하면 이 화면이 뜬다(page.tsx의 notFound()). 만료로 사라진 폴이라면
// 이 브라우저에 저장돼 있던 편집 토큰(localStorage)은 죽은 참조이므로 정리한다(FR-13, Q1).
export default function PollNotFound() {
  useEffect(() => {
    const match = window.location.pathname.match(/\/p\/([^/]+)/);
    const token = match?.[1];
    if (token) window.localStorage.removeItem(`meeet:poll:${token}`);
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-lg font-semibold">이 폴을 찾을 수 없어요</h1>
      <p className="mt-2 text-sm text-gray-600">
        링크가 잘못됐거나, 후보 기간이 지나 만료된 폴일 수 있어요.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
        새 폴 만들기 →
      </Link>
    </main>
  );
}
