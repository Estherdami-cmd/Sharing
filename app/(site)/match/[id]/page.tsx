import MatchFlow from "@/app/_components/MatchFlow";
import PageShell from "@/app/_components/PageShell";

/**
 * 2단계: 매칭 확인. 물품 id를 쿼리가 아니라 주소에 담는다.
 * 4단계(/complete/[id])와 같은 모양으로 맞춰 어느 단계든 주소가 대상을 그대로 가리킨다.
 * params로 받으니 useSearchParams가 필요 없고, 그래서 Suspense도 필요 없다.
 */
export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <MatchFlow donationId={id} />
    </PageShell>
  );
}
