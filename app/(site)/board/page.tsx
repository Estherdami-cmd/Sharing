import { Suspense } from "react";
import type { Metadata } from "next";
import NeedBoard from "@/app/_components/NeedBoard";
import Loading from "@/app/_components/Loading";
import PageShell from "@/app/_components/PageShell";

const TITLE = "지금 필요한 것들 — 여러시";
const DESCRIPTION = "기관이 올린 목표를 여럿이 나눠 채우고 있어요. 지금 진행 중인 나눔 현황을 확인해보세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "여러시",
    locale: "ko_KR",
    type: "website",
  },
};

/** 필터·검색어·정렬을 쿼리에서 읽으므로(useSearchParams) Suspense로 감싼다. */
export default function BoardPage() {
  return (
    <PageShell>
      <Suspense fallback={<Loading label="목록" size="lg" overlay />}>
        <NeedBoard />
      </Suspense>
    </PageShell>
  );
}
