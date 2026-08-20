import { Suspense } from "react";
import PageShell from "@/app/_components/PageShell";
import RegisterFlow from "@/app/_components/RegisterFlow";

/** 1단계: 물품 등록. 게시판에서 넘어온 needId를 읽으므로 Suspense로 감싼다. */
export default function DonatePage() {
  return (
    <PageShell>
      <Suspense fallback={<p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}>
        <RegisterFlow />
      </Suspense>
    </PageShell>
  );
}
