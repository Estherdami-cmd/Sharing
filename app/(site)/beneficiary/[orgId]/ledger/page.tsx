import PageShell from "@/app/_components/PageShell";
import HubLedger from "@/app/_components/hub/HubLedger";

export default async function HubLedgerPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <HubLedger hubId={orgId} />
    </PageShell>
  );
}
