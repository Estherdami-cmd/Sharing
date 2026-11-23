import { Suspense } from "react";
import PageShell from "@/app/_components/PageShell";
import { HubStorage } from "@/app/_components/hub/HubLists";

export default async function HubStoragePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <Suspense>
        <HubStorage hubId={orgId} />
      </Suspense>
    </PageShell>
  );
}
