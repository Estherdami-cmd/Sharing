import CompleteView from "@/app/_components/CompleteView";
import PageShell from "@/app/_components/PageShell";

/** 신청 완료. /apply의 한 단계가 아니라 주소를 갖는 별도 페이지라
 * 새로고침·뒤로가기가 정상 동작하고, 나중에 다시 들어와 상태를 확인할 수 있다. */
export default async function CompletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <CompleteView applicationId={id} />
    </PageShell>
  );
}
