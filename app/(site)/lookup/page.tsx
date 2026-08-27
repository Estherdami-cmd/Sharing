import type { Metadata } from "next";
import LookupFlow from "@/app/_components/LookupFlow";
import PageShell from "@/app/_components/PageShell";

const TITLE = "내 신청 조회 — 여러시";
const DESCRIPTION = "신청할 때 쓴 전화번호로 지금까지 낸 신청의 진행 상태를 확인해요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "여러시",
    locale: "ko_KR",
    type: "website",
  },
};

export default function LookupPage() {
  return (
    <PageShell>
      <LookupFlow />
    </PageShell>
  );
}
