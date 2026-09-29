"use client";

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { redactPollToken } from "@/lib/analytics";

function beforeSend(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: redactPollToken(event.url) };
}

// beforeSend는 함수라 서버 컴포넌트인 layout에서 직접 넘길 수 없어 클라이언트 래퍼로 감싼다.
export function Analytics() {
  return <VercelAnalytics beforeSend={beforeSend} />;
}
