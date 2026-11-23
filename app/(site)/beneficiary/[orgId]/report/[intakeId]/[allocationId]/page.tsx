import PageShell from "@/app/_components/PageShell";
import ReportFill from "@/app/_components/ReportFill";

export default async function ReportFillPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; intakeId: string; allocationId: string }>;
  searchParams: Promise<{ form?: string }>;
}) {
  const { orgId, intakeId, allocationId } = await params;
  const { form } = await searchParams;
  return (
    <PageShell>
      <ReportFill orgId={orgId} intakeId={intakeId} allocationId={allocationId} formId={form ?? null} />
    </PageShell>
  );
}
