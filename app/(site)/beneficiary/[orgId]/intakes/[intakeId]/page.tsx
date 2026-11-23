import PageShell from "@/app/_components/PageShell";
import IntakeReview from "@/app/_components/hub/IntakeReview";

export default async function IntakeReviewPage({
  params,
}: {
  params: Promise<{ orgId: string; intakeId: string }>;
}) {
  const { orgId, intakeId } = await params;
  return (
    <PageShell>
      <IntakeReview hubId={orgId} intakeId={intakeId} />
    </PageShell>
  );
}
