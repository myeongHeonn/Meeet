"use client";

import { useEffect, useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function handleCopy() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 클립보드 권한 거부 등 — 피드백 없이 무시한다.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 whitespace-nowrap"
    >
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
}
