import PageShell from "@/app/_components/PageShell";
import FacilityDeliveries from "@/app/_components/FacilityDeliveries";

export default async function FacilityDeliveriesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <FacilityDeliveries orgId={orgId} />
    </PageShell>
  );
}
