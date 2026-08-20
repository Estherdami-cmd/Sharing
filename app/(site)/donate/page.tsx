import PageShell from "@/app/_components/PageShell";
import RegisterFlow from "@/app/_components/RegisterFlow";

/** 1단계: 물품 등록. 쿼리를 읽지 않는 유일한 단계라 Suspense가 필요 없다. */
export default function DonatePage() {
  return (
    <PageShell>
      <RegisterFlow />
    </PageShell>
  );
}
