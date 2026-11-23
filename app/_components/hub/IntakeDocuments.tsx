"use client";

import { useEffect, useState } from "react";
import type { FormResponse } from "@/lib/form-store";
import Loading from "../Loading";
import { BackLink } from "../OrgCommon";
import { PdfButton, PrintStyle, ReportSheet } from "../ReportDocument";
import { caption } from "../../ui";

/**
 * 맡긴 물품 하나로 시설들이 기업 양식에 맞춰 낸 문서를 한 화면에 모은다.
 * "PDF로 저장"을 누르면 문서마다 새 쪽으로 나뉘어 한 파일로 나온다 — 기업이 증빙으로 그대로 낸다.
 */
export default function IntakeDocuments({ intakeId }: { intakeId: string }) {
  const [docs, setDocs] = useState<FormResponse[] | null>(null);

  useEffect(() => {
    fetch(`/api/intakes/${intakeId}/documents?full=1`)
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((d) => setDocs(d.documents))
      .catch(() => setDocs([]));
  }, [intakeId]);

  if (!docs) return <Loading label="문서" size="lg" overlay />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PrintStyle />
      <div className="no-print flex flex-col gap-3">
        <BackLink href={`/entrusted/${intakeId}`}>맡긴 물품</BackLink>
        <div className="flex items-center justify-between gap-2">
          <p className={caption}>시설이 보낸 문서 {docs.length}건 · 문서마다 새 쪽으로 나뉘어 한 파일로 받아져요</p>
          {docs.length > 0 && (
            <PdfButton label="모두 PDF로 저장" fileName={`${docs[0].auto.companyName}_${docs[0].auto.itemName}_시설문서.pdf`} />
          )}
        </div>
      </div>
      {docs.length === 0 && <p className="py-16 text-center text-neutral-500">아직 시설이 보낸 문서가 없어요</p>}
      {docs.map((d) => (
        <ReportSheet key={d.id} doc={d} />
      ))}
    </div>
  );
}
