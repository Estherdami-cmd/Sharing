import { Suspense } from "react";
import ApplyForm from "@/app/_components/ApplyForm";
import PageShell from "@/app/_components/PageShell";

/** 3단계: 나눔 신청. donationId·needId를 쿼리에서 읽으므로 Suspense로 감싼다. */
export default function ApplyPage() {
  return (
    <PageShell>
      <Suspense
        fallback={<p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}
      >
        <ApplyForm />
      </Suspense>
    </PageShell>
  );
}
