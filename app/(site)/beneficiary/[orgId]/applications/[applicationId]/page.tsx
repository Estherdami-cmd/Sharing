import ApplicationReview from "@/app/_components/ApplicationReview";
import PageShell from "@/app/_components/PageShell";

export default async function ApplicationReviewPage({
  params,
}: {
  params: Promise<{ orgId: string; applicationId: string }>;
}) {
  const { orgId, applicationId } = await params;
  return (
    <PageShell>
      <ApplicationReview orgId={orgId} applicationId={applicationId} />
    </PageShell>
  );
}
