import OrgHome from "@/app/_components/OrgHome";
import PageShell from "@/app/_components/PageShell";

export default async function OrgHomePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <PageShell>
      <OrgHome orgId={orgId} />
    </PageShell>
  );
}
