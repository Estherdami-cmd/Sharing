import { Suspense } from "react";
import MatchFlow from "@/app/_components/MatchFlow";
import PageShell from "@/app/_components/PageShell";

/** 2단계: 매칭 확인. donationId를 쿼리에서 읽으므로 Suspense로 감싼다. */
export default function DonateMatchPage() {
  return (
    <PageShell>
      <Suspense
        fallback={<p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}
      >
        <MatchFlow />
      </Suspense>
    </PageShell>
  );
}
