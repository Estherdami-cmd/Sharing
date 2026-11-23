import PageShell from "@/app/_components/PageShell";
import ReportDocument from "@/app/_components/ReportDocument";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell>
      <ReportDocument id={id} />
    </PageShell>
  );
}
