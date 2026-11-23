import PageShell from "@/app/_components/PageShell";
import HubSchedule from "@/app/_components/hub/HubSchedule";

export default async function HubSchedulePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <HubSchedule hubId={orgId} />
    </PageShell>
  );
}
