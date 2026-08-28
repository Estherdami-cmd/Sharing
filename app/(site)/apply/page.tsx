import { Suspense } from "react";
import ApplyForm from "@/app/_components/ApplyForm";
import Loading from "@/app/_components/Loading";
import PageShell from "@/app/_components/PageShell";

/** 3단계: 나눔 신청. donationId·needId를 쿼리에서 읽으므로 Suspense로 감싼다. */
export default function ApplyPage() {
  return (
    <PageShell>
      <Suspense fallback={<Loading label="신청서" fullPage />}>
        <ApplyForm />
      </Suspense>
    </PageShell>
  );
}
