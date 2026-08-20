import { Suspense } from "react";
import ApplyFlow from "@/app/_components/ApplyFlow";
import PageShell from "@/app/_components/PageShell";

export default function ApplyPage() {
  return (
    <PageShell showDisclaimer>
      <Suspense fallback={<p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}>
        <ApplyFlow />
      </Suspense>
    </PageShell>
  );
}
