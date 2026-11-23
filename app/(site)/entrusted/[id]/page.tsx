import PageShell from "@/app/_components/PageShell";
import IntakeReport from "@/app/_components/hub/IntakeReport";

/** 배분기관에 맡긴 물품의 진행 상황과 결과 보고서. 기부자에게 주는 주소다. */
export default async function EntrustedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <IntakeReport intakeId={id} />
    </PageShell>
  );
}
