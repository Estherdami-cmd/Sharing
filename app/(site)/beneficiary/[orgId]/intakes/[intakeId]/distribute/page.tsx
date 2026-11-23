import PageShell from "@/app/_components/PageShell";
import DistributeForm from "@/app/_components/hub/DistributeForm";

export default async function DistributePage({
  params,
}: {
  params: Promise<{ orgId: string; intakeId: string }>;
}) {
  const { orgId, intakeId } = await params;
  return (
    <PageShell>
      <DistributeForm hubId={orgId} intakeId={intakeId} />
    </PageShell>
  );
}
