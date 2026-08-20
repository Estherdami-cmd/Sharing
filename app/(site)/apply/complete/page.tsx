import { Suspense } from "react";
import ApplyComplete from "@/app/_components/ApplyComplete";
import PageShell from "@/app/_components/PageShell";

/** 4단계: 신청 완료. applicationId를 쿼리에서 읽으므로 Suspense로 감싼다. */
export default function ApplyCompletePage() {
  return (
    <PageShell>
      <Suspense
        fallback={<p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}
      >
        <ApplyComplete />
      </Suspense>
    </PageShell>
  );
}
