"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  clampTargetQty,
  formatKoreanDate,
  isSameItem,
  withJosa,
} from "@/lib/rules";
import type { ApplicationDetail, Beneficiary, NeedView } from "@/lib/store";
import NeedProgress from "./NeedProgress";
import Loading from "./Loading";
import { useRefetchOnFocus } from "./useRefetchOnFocus";
import {
  btnDanger,
  btnGhost,
  btnOutline,
  btnPrimary,
  card,
  caption,
  field,
  label,
  pageDesc,
  pageTitle,
  sectionTitle,
  toneBadge,
} from "../ui";

// 목록으로 받을 때는 서버가 연락처를 항상 null로 가려서 보낸다.
// 카드에서 "보기"를 눌러야 개별 조회(GET /api/applications/:id)로 채워진다.
type ApplicationRow = Omit<ApplicationDetail, "contact"> & {
  contact: string | null;
};

const STATUS_BADGE = {
  pending: { tone: "caution", label: "대기중" },
  accepted: { tone: "ok", label: "수락됨" },
  rejected: { tone: "blocked", label: "거절됨" },
} as const;

export default function AdminPanel() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  // 타이핑 중에는 빈 칸을 허용해야 한다. 매 키 입력마다 1로 되돌리면 필드를 지울 수 없고,
  // 지운 자리에 강제로 들어간 1 뒤에 이어 쳐서 "50"이 "150"이 된다. 포커스가 빠질 때 다듬는다.
  const [targetQty, setTargetQty] = useState<number | "">(50);
  const targetQtyValue = targetQty === "" ? 1 : targetQty;
  const [note, setNote] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  /**
   * 필요 물품 등록 폼은 대화상자로 띄운다. 모바일에서 이 폼이 화면 위쪽을 차지하면
   * 기관의 주 업무인 "들어온 신청"이 한참 아래로 밀린다.
   *
   * 직접 만든 오버레이 대신 <dialog>를 쓴다 — 포커스 가둠과 Esc 닫기를 브라우저가
   * 해준다. 다만 **배경 스크롤 잠금은 안 해준다**(실측: 열린 상태에서 배경이
   * 205px 스크롤됐다). 그건 아래 useEffect에서 직접 막는다.
   */
  const formDialogRef = useRef<HTMLDialogElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  // 지금 연락처를 불러오는 중인 신청 id들. 버튼을 눌렀는데 아무 반응이 없어 보이지 않게.
  const [revealingContactIds, setRevealingContactIds] = useState<Set<string>>(
    new Set(),
  );
  // 한 번 확인한 연락처는 기억해둔다. 목록 API는 항상 연락처를 가려서 주므로,
  // 이 기억이 없으면 포커스가 돌아올 때마다(useRefetchOnFocus) 방금 본 번호가
  // 다시 잠긴다 — 전화 걸려고 다른 앱에 갔다 오는 딱 이 기능의 실제 쓰임에서 계속 걸린다.
  const revealedContactsRef = useRef<Record<string, string>>({});
  const [resolvedFilter, setResolvedFilter] = useState<"pending" | "all">(
    "pending",
  );

  /*
   * "등록한 요청"은 말 그대로 우리 기관이 등록한 것만 본다. 예전에는 114개 기관의
   * 요청 41건을 전부 뿌려서, 모바일에서 이 목록만 8,497px(페이지의 81%)이었고
   * 남의 기관 이름이 카드에 찍혔다. 섹션 제목과도 맞지 않았다.
   */
  const myNeeds = needs.filter((need) => need.beneficiaryId === beneficiaryId);
  const selectedBeneficiaryName = beneficiaries.find(
    (fb) => fb.id === beneficiaryId,
  )?.name;

  async function handleRevealContact(id: string) {
    setRevealingContactIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/applications/${id}`);
      if (res.ok) {
        const detail = await res.json();
        revealedContactsRef.current[id] = detail.contact;
        setApplications((prev) =>
          prev.map((app) =>
            app.id === id ? { ...app, contact: detail.contact } : app,
          ),
        );
      }
    } finally {
      setRevealingContactIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [needsRes, appsRes] = await Promise.all([
      fetch("/api/needs"),
      fetch("/api/applications"),
    ]);
    if (needsRes.ok) {
      const data = await needsRes.json();
      setNeeds(data.needs);
      setBeneficiaries(data.beneficiaries);
      // 기관 114곳 중 80곳은 요청이 0건이다. 그냥 첫 번째를 고르면 화면이 텅 빈
      // 상태로 열려서 뭐가 잘못된 것처럼 보인다. 요청이 있는 기관을 기본값으로 둔다.
      setBeneficiaryId((prev) => {
        if (prev) return prev;
        const withNeeds = data.beneficiaries.find((fb: Beneficiary) =>
          data.needs.some((need: NeedView) => need.beneficiaryId === fb.id),
        );
        return withNeeds?.id ?? data.beneficiaries[0]?.id ?? "";
      });
    }
    if (appsRes.ok) {
      const data: ApplicationRow[] = await appsRes.json();
      setApplications(
        data.map((app) => ({
          ...app,
          contact: revealedContactsRef.current[app.id] ?? app.contact,
        })),
      );
    }
    setLoading(false);
  }, []);

  /*
   * 대화상자가 열려 있는 동안 배경이 스크롤되지 않게 한다. 모바일에서 시트를
   * 만지다 배경이 밀리면 어디를 보고 있었는지 잃어버린다.
   *
   * overflow를 숨기면 데스크탑에서 스크롤바가 사라져 내용이 옆으로 튄다.
   * 사라진 스크롤바 폭만큼 padding으로 메워 그 흔들림을 없앤다.
   */
  useEffect(() => {
    if (!formOpen) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const prevOverflow = root.style.overflow;
    const prevPadding = root.style.paddingRight;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = prevOverflow;
      root.style.paddingRight = prevPadding;
    };
  }, [formOpen]);

  useEffect(() => {
    load();
  }, [load]);

  // 이 탭을 열어둔 채로 다른 곳에서 새 신청이 들어와도 자동으로는 안 보였다.
  // 탭을 다시 보면(포커스) 들어온 신청·진행률을 다시 불러온다.
  useRefetchOnFocus(load);

  /*
   * 신청도 선택한 기관 것만 본다. 기관 선택이 페이지 상단으로 올라와 화면 전체의
   * 범위를 정하게 됐는데, 신청만 전체 기관 것을 보여주면 범위가 어긋난다.
   * 아래 개수들도 같은 범위여야 한다 — "지난 신청도 보기 (N건)"의 N이 남의 기관
   * 신청까지 세면 눌렀을 때 숫자와 목록이 안 맞는다.
   */
  const myApplications = applications.filter(
    (a) => a.beneficiaryId === beneficiaryId,
  );
  const pendingCount = myApplications.filter(
    (a) => a.status === "pending",
  ).length;
  const resolvedCount = myApplications.length - pendingCount;
  // 대기중 신청은 처리해야 할 일이고, 끝난 신청은 기록이다. 계속 쌓이는 기록 사이에
  // 방금 들어온 대기중 신청이 묻히지 않게, 기본은 대기중만 보여준다.
  const visibleApplications =
    resolvedFilter === "pending"
      ? myApplications.filter((a) => a.status === "pending")
      : myApplications;

  function handleImageSelected(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError("이미지 파일만 올릴 수 있어요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.onerror = () => setImageError("사진을 읽지 못했어요");
    reader.readAsDataURL(file);
  }

  function handleClearImage() {
    setImageUrl(null);
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleCreateNeed() {
    setFormError(null);
    if (!itemName.trim()) {
      setFormError("품목명을 입력해주세요");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/needs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryId,
        itemName,
        category,
        targetQty: targetQtyValue,
        note,
        imageUrl,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      // 서버가 이유를 구체적으로 적어 보내면(카테고리 오류, 이미지 용량 초과 등)
      // 그 문장을 그대로 쓴다 — 뭉뚱그린 안내로는 사용자가 원인을 짐작할 수 없다.
      const body = await res.json().catch(() => null);
      setFormError(body?.error ?? "등록에 실패했어요. 다시 시도해주세요");
      return;
    }
    setItemName("");
    setTargetQty(50);
    setNote("");
    handleClearImage();
    formDialogRef.current?.close();
    load();
  }

  async function handleDecision(
    id: string,
    status: "accepted" | "rejected",
    confirmed?: { date: string; slot: string },
  ) {
    await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        confirmedDate: confirmed?.date,
        confirmedSlot: confirmed?.slot,
      }),
    });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className={pageTitle}>기관 관리</h1>
        <p className={pageDesc}>필요한 물품을 올리고, 들어온 신청을 확인해요</p>
        <button
          onClick={load}
          aria-label="새로고침"
          className={`${btnGhost} mt-2 inline-flex items-center justify-center`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </header>

      {/*
        기관 선택은 이 화면 전체의 범위를 정한다 — 아래 "등록한 요청"과 "들어온 신청"이
        모두 여기서 고른 기관 것이다. 그래서 대화상자 안이 아니라 페이지에 둔다.
      */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/70 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="beneficiary-select" className={label}>
            우리 기관
          </label>
          {/*
            기관 목록도 같이 불러오므로 처음에는 비어 있다. 빈 선택 상자는
            "고를 게 없다"로 읽혀서, 목록이 오기 전까지는 그렇게 말해준다.
          */}
          <select
            id="beneficiary-select"
            value={beneficiaryId}
            onChange={(e) => setBeneficiaryId(e.target.value)}
            disabled={beneficiaries.length === 0}
            className={field}
          >
            {beneficiaries.length === 0 ? (
              <option value="">기관 목록을 불러오고 있어요</option>
            ) : (
              beneficiaries.map((fb) => (
                <option key={fb.id} value={fb.id}>
                  {fb.name}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          onClick={() => {
            setFormOpen(true);
            formDialogRef.current?.showModal();
          }}
          className={`${btnPrimary} flex shrink-0 items-center justify-center gap-1.5 sm:w-auto sm:px-5`}
        >
          <span aria-hidden className="text-[18px] leading-none">
            +
          </span>
          필요 물품 올리기
        </button>
      </div>

      {/*
        기관을 고르기 전까지 아래가 전부 이 기관 것이라, 일부만 채워 보여주면
        어느 기관 얘긴지 헷갈린다. 다 오기 전까지는 이 아래를 통째로 스피너
        하나로 둔다.

        기관 선택과 새로고침은 위에 그대로 남긴다 — 로딩 중에도 다른 기관으로
        바꾸거나 다시 불러올 수 있어야 한다.
      */}
      {loading ? (
        <Loading label="기관 현황" size="lg" fullPage />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <div>
                <h2 className={sectionTitle}>등록한 요청 · 진행률</h2>
                {/* withJosa로 받침을 본다. 그냥 "이"를 붙이면 "경동교회이"가 된다. */}
                {selectedBeneficiaryName && (
                  <p className={`${caption} mt-1`}>
                    {withJosa(selectedBeneficiaryName, "이", "가")} 올린
                    요청이에요
                  </p>
                )}
              </div>
              {myNeeds.length === 0 && (
                <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-[15px] text-neutral-400">
                  아직 올린 요청이 없어요. 위 버튼으로 필요한 물품을 올려보세요
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {myNeeds.map((need) => (
                  <article key={need.id} className={card}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 gap-3">
                        {need.imageUrl && (
                          <img
                            src={need.imageUrl}
                            alt={`${need.itemName} 사진`}
                            className="size-14 shrink-0 rounded-xl object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <h3 className="text-[17px] font-bold tracking-[-0.02em]">
                            {need.itemName}
                          </h3>
                          <p className="text-xs text-neutral-400">
                            {need.category}
                          </p>
                        </div>
                      </div>
                      {need.urgent && (
                        <span className={toneBadge("caution")}>
                          도움이 필요해요
                        </span>
                      )}
                    </div>
                    <NeedProgress
                      filledQty={need.filledQty}
                      targetQty={need.targetQty}
                      progress={need.progress}
                      pendingQty={need.pendingQty}
                    />
                    {need.note && <p className={caption}>{need.note}</p>}
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className={sectionTitle}>들어온 신청</h2>
              {resolvedCount > 0 && (
                <button
                  onClick={() =>
                    setResolvedFilter((f) =>
                      f === "pending" ? "all" : "pending",
                    )
                  }
                  className="cursor-pointer border-none bg-transparent text-xs font-bold text-primary-700 hover:text-primary-800"
                >
                  {resolvedFilter === "pending"
                    ? `지난 신청도 보기 (${resolvedCount}건)`
                    : "대기중만 보기"}
                </button>
              )}
            </div>

            {visibleApplications.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-8">
                <img
                  src="https://picsum.photos/seed/empty-apply/240/180"
                  alt="들어온 신청이 없는 상태를 나타내는 이미지"
                  className="w-60 rounded-2xl opacity-40 grayscale"
                />
                <p className="text-[15px] text-neutral-400">
                  {myApplications.length === 0
                    ? "아직 들어온 신청이 없어요"
                    : "대기중인 신청이 없어요"}
                </p>
              </div>
            )}

            {visibleApplications.map((app) => (
              <article key={app.id} className={card}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold">
                      {app.beneficiary.name}
                    </p>
                    {app.need && (
                      <p className="mt-0.5 text-[13px] font-bold text-primary-700">
                        {app.need.itemName} 목표 채우기 (현재 {app.need.progress}
                        %)
                      </p>
                    )}
                    <p className="mt-1.5 text-[13px] text-neutral-600">
                      {app.donation.itemName} ({app.donation.category}) ·{" "}
                      {app.quantity}개
                    </p>
                    {/* 문구만으로는 포장 상태나 라벨이 맞는지 알 수 없다. 기부자가 등록할 때
                        올린 사진을 그대로 보여줘 수락 전에 확인할 수 있게 한다. */}
                    {(app.donation.productImageUrl ||
                      app.donation.expiryImageUrl) && (
                      <div className="mt-1.5 flex gap-2">
                        {app.donation.productImageUrl && (
                          <a
                            href={app.donation.productImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={app.donation.productImageUrl}
                              alt="기부자가 올린 제품 사진"
                              className="h-16 w-16 rounded-lg border border-neutral-200 object-cover"
                            />
                          </a>
                        )}
                        {app.donation.expiryImageUrl && (
                          <a
                            href={app.donation.expiryImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={app.donation.expiryImageUrl}
                              alt="기부자가 올린 유통기한 사진"
                              className="h-16 w-16 rounded-lg border border-neutral-200 object-cover"
                            />
                          </a>
                        )}
                      </div>
                    )}
                    {app.donation.expiryDate && (
                      <p className="text-[13px] text-neutral-500">
                        유통기한: {app.donation.expiryDate}
                      </p>
                    )}
                    {app.confirmedDate ? (
                      <p className="text-[13px] font-semibold text-success-fg">
                        확정된 날짜: {formatKoreanDate(app.confirmedDate)}{" "}
                        {app.confirmedSlot}
                      </p>
                    ) : (
                      <p className="text-[13px] text-neutral-500">
                        제안 날짜:{" "}
                        {app.candidateDates
                          .map((c) => `${formatKoreanDate(c.date)} ${c.slot}`)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="text-[13px] text-neutral-500">
                      전달 장소: {app.place}
                    </p>
                    <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
                      연락처:{" "}
                      {app.contact ? (
                        app.contact
                      ) : (
                        <button
                          onClick={() => handleRevealContact(app.id)}
                          disabled={revealingContactIds.has(app.id)}
                          className="cursor-pointer border-none bg-transparent p-0 font-bold text-primary-700 hover:text-primary-800"
                        >
                          {revealingContactIds.has(app.id)
                            ? "불러오는 중..."
                            : "보기"}
                        </button>
                      )}
                    </p>
                    {app.receiptRequested && (
                      <p className="mt-1 text-[13px] font-semibold text-success-fg">
                        기부금 신청서 작성 요청됨
                      </p>
                    )}
                  </div>
                  <span className={toneBadge(STATUS_BADGE[app.status].tone)}>
                    {STATUS_BADGE[app.status].label}
                  </span>
                </div>

                {app.status === "pending" &&
                  app.need &&
                  app.donation.category !== app.need.category && (
                    <p className="text-xs text-warning-fg">
                      카테고리가 달라 수락해도 이 요청의 진행률에는 반영되지
                      않아요
                    </p>
                  )}

                {/*
                  카테고리는 같은데 물건이 다른 경우. 지금까지는 기관이 모른 채 수락하고
                  진행률만 올랐다. 받을 수 있는 물건인지는 기관만 판단할 수 있으니
                  여기서는 돌려 말하지 않는다 — 기부자는 이 화면을 보지 않는다.
                */}
                {app.status === "pending" &&
                  app.need &&
                  app.donation.category === app.need.category &&
                  !isSameItem(app.donation.itemName, app.need.itemName) && (
                    <p className="text-xs text-warning-fg">
                      &apos;{app.need.itemName}&apos; 요청과 다른 물품이에요.
                      받으실 수 있는지 확인해주세요
                    </p>
                  )}

                {app.status === "pending" && (
                  <div className="flex flex-col gap-2">
                    {app.need && app.donation.category === app.need.category && (
                      <p className="text-xs text-neutral-500">
                        {(() => {
                          // 다른 신청이 먼저 수락돼 이미 목표가 다 찼을 수 있다 — 그럴 땐
                          // 이 신청을 수락해도 실제로는 0만큼만 반영된다.
                          const gain = Math.min(
                            app.quantity,
                            app.need!.remainingQty,
                          );
                          return gain > 0
                            ? `수락하면 진행률 +${gain}`
                            : "이미 목표를 달성한 요청이에요";
                        })()}
                      </p>
                    )}
                    <p className="text-xs font-bold text-neutral-500">
                      제안된 날짜 중 하나를 선택해 수락하세요
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {app.candidateDates.map((c) => (
                        <button
                          key={`${c.date}-${c.slot}`}
                          onClick={() => handleDecision(app.id, "accepted", c)}
                          className={`${btnOutline} border-primary-500 text-primary-700 hover:border-primary-600`}
                        >
                          {formatKoreanDate(c.date)} {c.slot}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDecision(app.id, "rejected")}
                      className={btnDanger}
                    >
                      거절
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </div>
      )}

      {/*
        모바일에서는 밑에서 올라오는 시트, 넓은 화면에서는 가운데 대화상자로 보인다.
        포커스 가둠과 Esc 닫기는 <dialog>가 해준다. 배경 클릭으로 닫기와 배경
        스크롤 잠금은 브라우저가 안 해줘서 직접 붙였다.
      */}
      <dialog
        ref={formDialogRef}
        onClose={() => setFormOpen(false)}
        onClick={(e) => {
          if (e.target === formDialogRef.current) formDialogRef.current.close();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-none bg-white p-5 backdrop:bg-neutral-900/40 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-2xl"
      >
        {/* 폼 안의 클릭이 배경 닫기로 새지 않게 여기서 멈춘다. */}
        <div
          className="flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={sectionTitle}>필요 물품 올리기</h2>
              <p className={`${caption} mt-1`}>
                목표 수량을 정하면 기부자들이 나눠서 채워요
              </p>
            </div>
            <button
              onClick={() => formDialogRef.current?.close()}
              aria-label="닫기"
              className={`${btnGhost} shrink-0`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="size-5"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/*
              기관 선택은 페이지에 있다. 대화상자 안에 또 두면 "지금 보고 있는 기관"과
              "올릴 기관"이 달라질 수 있어 헷갈린다. 여기서는 어디에 올리는지만 알린다.
            */}
          {selectedBeneficiaryName && (
            <p className="rounded-xl bg-primary-50 px-3 py-2 text-[13px] text-primary-800">
              <b>{selectedBeneficiaryName}</b>의 요청으로 올라가요
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={label}>필요한 품목</label>
            <input
              placeholder="예: 성인용 기저귀 대형"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={field}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>목표 수량</label>
            <input
              type="number"
              min={1}
              value={targetQty}
              onChange={(e) =>
                setTargetQty(
                  e.target.value === "" ? "" : clampTargetQty(e.target.value),
                )
              }
              onBlur={() => setTargetQty(targetQtyValue)}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>안내 문구 (선택)</label>
            <input
              placeholder="예: 요양 어르신 12분께 매주 전달돼요"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>대표 사진 (선택)</label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={imageUrl}
                  alt="등록할 물품 사진 미리보기"
                  className="size-20 rounded-xl object-cover"
                />
                <button onClick={handleClearImage} className={btnGhost}>
                  지우기
                </button>
              </div>
            ) : (
              <button
                onClick={() => imageInputRef.current?.click()}
                className={btnOutline}
              >
                사진 선택
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelected(e.target.files?.[0])}
              className="hidden"
            />
            {imageError && (
              <p className="text-[13px] text-danger-fg">{imageError}</p>
            )}
          </div>

          <p className={caption}>
            "도움이 필요해요" 표시는 진행률 30% 미만인 요청에 자동으로 붙어요
          </p>

          {formError && (
            <p className="text-[13px] text-danger-fg">{formError}</p>
          )}

          <button
            onClick={handleCreateNeed}
            disabled={submitting}
            className={btnPrimary}
          >
            {submitting ? "등록 중..." : "필요 물품 등록"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
