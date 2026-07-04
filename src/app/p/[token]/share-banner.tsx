"use client";

import { useEffect, useState } from "react";
import { CopyLinkButton } from "@/app/components/copy-link-button";
import { creatorFlagKey } from "@/lib/creator-flag";

// 방금 폴을 만든 생성자(같은 탭, sessionStorage 플래그 보유)에게만
// 공유 링크를 다시 노출한다. 닫으면 플래그를 지워 다시 뜨지 않는다.
export function ShareBanner({ token }: { token: string }) {
  const [url, setUrl] = useState<string | null>(null);

  // sessionStorage는 브라우저에만 있으므로 마운트 후에 읽는다(hydration mismatch 방지).
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(creatorFlagKey(token)) === "1") {
        setUrl(`${window.location.origin}/p/${token}`);
      }
    } catch {
      // 저장소가 막힌 환경에서는 배너를 띄우지 않는다.
    }
  }, [token]);

  if (!url) return null;

  function dismiss() {
    try {
      window.sessionStorage.removeItem(creatorFlagKey(token));
    } catch {
      // 플래그 제거 실패해도 이번 화면에서는 닫는다.
    }
    setUrl(null);
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-amber-900">
          폴이 만들어졌어요 — 이 링크를 참가자에게 공유하세요.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="공유 안내 닫기"
          className="text-amber-400 transition hover:text-amber-600"
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="공유 링크"
          className="w-full rounded-lg border border-amber-200 bg-white px-4 py-2 font-mono text-xs outline-none"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyLinkButton url={url} />
      </div>
    </div>
  );
}
