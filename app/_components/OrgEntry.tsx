"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Beneficiary, NeedView } from "@/lib/store";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import Loading from "./Loading";
import { orgHomePath } from "./OrgCommon";
import { btnPrimary, card, field, label, pageDesc, pageTitle } from "../ui";

/** 기관 흐름의 첫 화면. 어느 기관으로 일할지 정하고 관리 코드를 확인한다. */
export default function OrgEntry() {
  const router = useRouter();
  const admin = useAdminCode();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetch("/api/needs")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { needs: NeedView[]; beneficiaries: Beneficiary[] }) => {
        setBeneficiaries(data.beneficiaries);
        // 기관 114곳 중 다수는 요청이 0건이다. 그냥 첫 번째를 고르면 텅 빈 홈으로
        // 들어가 뭐가 잘못된 것처럼 보인다. 요청이 있는 기관을 기본값으로 둔다.
        const withNeeds = data.beneficiaries.find((fb) =>
          data.needs.some((need) => need.beneficiaryId === fb.id),
        );
        setOrgId(withNeeds?.id ?? data.beneficiaries[0]?.id ?? "");
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="기관 목록" size="lg" overlay />;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header className="text-center">
        <h1 className={pageTitle}>기관 관리</h1>
        <p className={pageDesc}>필요한 물품을 올리고, 들어온 신청을 확인해요</p>
      </header>

      <div className={card}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="beneficiary-select" className={label}>
            우리 기관
          </label>
          {loadFailed ? (
            <p className="text-[13px] text-danger-fg">
              기관 목록을 불러오지 못했어요. 새로고침해주세요
            </p>
          ) : (
            <select
              id="beneficiary-select"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className={field}
            >
              {beneficiaries.map((fb) => (
                <option key={fb.id} value={fb.id}>
                  {fb.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {/* 코드 입력란이 자기 form을 가지므로 바깥을 form으로 감싸지 않는다. */}
        <AdminCodeField {...admin.field} />
      </div>

      <button
        type="button"
        disabled={!orgId || !admin.codeReady}
        onClick={() => router.push(orgHomePath(orgId))}
        className={btnPrimary}
      >
        {admin.codeState === "needed" ? "관리 코드를 먼저 확인해주세요" : "들어가기"}
      </button>
    </div>
  );
}
