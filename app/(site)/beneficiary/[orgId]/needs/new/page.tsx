import NeedForm from "@/app/_components/NeedForm";
import PageShell from "@/app/_components/PageShell";

export default async function NewNeedPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <NeedForm orgId={orgId} />
    </PageShell>
  );
}
