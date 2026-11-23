import OrgHome from "@/app/_components/OrgHome";
import PageShell from "@/app/_components/PageShell";
import HubDashboard from "@/app/_components/hub/HubDashboard";
import { isHub } from "@/lib/hub";
import { getBeneficiary } from "@/lib/store";

/** 같은 기관 관리 주소를 쓰되, 배분기관이면 맡은 시설 전체를 보는 대시보드를 연다. */
export default async function OrgHomePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const org = await getBeneficiary(orgId).catch(() => undefined);
  return <PageShell>{isHub(org) ? <HubDashboard hubId={orgId} /> : <OrgHome orgId={orgId} />}</PageShell>;
}
