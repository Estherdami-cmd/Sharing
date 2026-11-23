import PageShell from "@/app/_components/PageShell";
import ReportFill from "@/app/_components/ReportFill";

export default async function ReportFillPage({
  params,
}: {
  params: Promise<{ orgId: string; intakeId: string; allocationId: string }>;
}) {
  const { orgId, intakeId, allocationId } = await params;
  return (
    <PageShell>
      <ReportFill orgId={orgId} intakeId={intakeId} allocationId={allocationId} />
    </PageShell>
  );
}
