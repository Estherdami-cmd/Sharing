import PageShell from "@/app/_components/PageShell";
import { HubIntakes } from "@/app/_components/hub/HubLists";

export default async function HubIntakesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <HubIntakes hubId={orgId} />
    </PageShell>
  );
}
