import ApplyComplete from "@/app/_components/ApplyComplete";
import PageShell from "@/app/_components/PageShell";

/**
 * 4단계: 신청 완료. 신청 id를 쿼리가 아니라 주소에 담는다.
 * 신청 하나하나가 나중에 다시 열어볼 대상이라 주소가 그 자체로 가리키는 게 맞다.
 * params로 받으니 useSearchParams가 필요 없고, 그래서 Suspense도 필요 없다.
 */
export default async function CompletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <ApplyComplete applicationId={id} />
    </PageShell>
  );
}
