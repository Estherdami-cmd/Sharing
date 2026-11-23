import PageShell from "@/app/_components/PageShell";
import IntakeDocuments from "@/app/_components/hub/IntakeDocuments";

export default async function IntakeDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <IntakeDocuments intakeId={id} />
    </PageShell>
  );
}
