import PageShell from "@/app/_components/PageShell";
import WalkinIntake from "@/app/_components/hub/WalkinIntake";

export default async function WalkinIntakePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <WalkinIntake hubId={orgId} />
    </PageShell>
  );
}
