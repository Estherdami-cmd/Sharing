"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  DEFAULT_REGION,
  type ExpiryStatus,
  ITEM_KIND_LABEL,
  type ItemKind,
  MAX_DONATION_QUANTITY,
  MAX_PACK_SIZE,
  type ShareVerdict,
  categoriesFor,
  clampQuantity,
  evaluateShareable,
  formatKoreanDate,
  isValidISODate,
  isValidPhone,
} from "@/lib/rules";
import {
  TONE_LABEL,
  TONE_TEXT,
  btnDanger,
  btnGhost,
  btnOutline,
  btnOutlineCompact,
  btnPrimary,
  btnSecondary,
  card,
  field,
  label,
  pageDesc,
  pageTitle,
  toneBadge,
} from "../ui";

type PhotoSlotKey = "product" | "expiry";
type RecognizeStatus = "idle" | "loading" | "done" | "error";

/**
 * 발표용으로 번들해 둔 실제 제품 사진 두 장(아침에주스 오렌지 210mL).
 * 앞면에 품목명, 뒷면에 유통기한이 따로 있어 두 슬롯 구조를 그대로 보여준다.
 * 제품 사진 파일명은 rules.ts의 juice 샘플 keywords와 맞춰뒀다. 모델 호출이
 * 실패해 목업으로 떨어져도 같은 품목이 나와 시연이 안 끊긴다.
 */
const DEMO_PHOTOS = {
  product: { src: "/demo/juice-front.jpg", fileName: "juice-front.jpg" },
  expiry: { src: "/demo/juice-back.jpg", fileName: "juice-back.jpg" },
} as const;

/**
 * 사진을 그대로 보내면 휴대폰 사진 한 장이 수 MB라 요청이 커진다. 기관이 화면에서
 * 확인하는 용도로는 이 정도 크기면 충분해서, 올릴 때 한 번 줄인다.
 * 실패하면(브라우저 미지원 등) null을 돌려주고 사진 없이 등록을 계속 진행한다 —
 * 사진 첨부가 등록 자체를 막을 이유는 없다.
 */
async function resizeImageToDataUrl(
  file: File,
  maxDim = 960,
  quality = 0.72,
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

/**
 * 1단계: 물품 등록.
 * 등록에 성공하면 만들어진 물품 id를 쿼리에 실어 2단계 주소로 넘긴다.
 * 사진은 줄여서 함께 등록에 실어 보낸다 — 기관이 신청을 검토할 때 실제 사진을
 * 같이 봐야 문구만으로는 알 수 없는 것(포장 상태, 라벨이 맞는지 등)을 확인할 수 있다.
 */
/** /api/recognize가 목업으로 떨어졌을 때 알려주는 이유. */
type RecognizeFailure =
  | { kind: "rate_limit"; retryAfterSeconds: number | null }
  | { kind: "no_key" }
  | { kind: "error" };

/** "1728초" 대신 "약 29분"으로 말한다. */
function formatWait(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `약 ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `약 ${hours}시간` : `약 ${hours}시간 ${rest}분`;
}

/**
 * 목업으로 떨어진 이유별 문구. 제목을 나누는 게 중요하다 —
 * 한도 초과에 "연결하지 못했어요"라고 말하면 배포나 네트워크를 엉뚱하게 뒤지게 된다.
 */
function failureCopy(failure: RecognizeFailure | null): {
  title: string;
  detail: string;
} {
  if (failure?.kind === "rate_limit") {
    const wait = failure.retryAfterSeconds
      ? formatWait(failure.retryAfterSeconds)
      : null;
    return {
      title: "오늘 AI 판독 한도를 다 썼어요",
      detail: wait
        ? `${wait} 뒤에 다시 쓸 수 있어요. 서버 문제가 아니에요.`
        : "잠시 뒤에 다시 쓸 수 있어요. 서버 문제가 아니에요.",
    };
  }
  if (failure?.kind === "no_key") {
    return {
      title: "AI 판독이 설정되지 않았어요",
      detail: "관리자에게 알려주세요 (OPENAI_API_KEY 미설정).",
    };
  }
  return {
    title: "AI 서버에 연결하지 못했어요",
    detail: "잠시 뒤에 다시 시도해주세요.",
  };
}

export default function RegisterFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetNeedId = searchParams.get("needId");

  // 게시판에서 특정 요청으로 바로 들어온 경우, 등록 화면에 "지금 누굴 돕는지" 안내를 보여준다.
  const [presetNeed, setPresetNeed] = useState<{
    itemName: string;
    beneficiaryName: string;
  } | null>(null);
  useEffect(() => {
    if (!presetNeedId) return;
    fetch("/api/needs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const found = data?.needs?.find(
          (n: { id: string }) => n.id === presetNeedId,
        );
        if (found)
          setPresetNeed({
            itemName: found.itemName,
            beneficiaryName: found.beneficiary.name,
          });
      })
      .catch(() => {});
  }, [presetNeedId]);

  // 기업·단체로 기부하면 이름(결과 보고서용)과 담당자 연락처(수거 일정용)를 같이 받는다.
  // ?donor=company로 들어오면 기업으로 시작한다.
  const [donorType, setDonorType] = useState<"individual" | "company">(
    searchParams.get("donor") === "company" ? "company" : "individual",
  );
  // 이미 기부하기 화면에 있을 때 헤더의 "기업 등록"을 누르면 화면이 새로 그려지지 않으니 따라 바꾼다.
  const donorParam = searchParams.get("donor");
  useEffect(() => {
    setDonorType(donorParam === "company" ? "company" : "individual");
  }, [donorParam]);
  const [companyName, setCompanyName] = useState("");
  const [companyManager, setCompanyManager] = useState("");
  const [companyContact, setCompanyContact] = useState("");
  // 이미 관리 코드를 받은 기업이면 코드로 불러와 같은 기업의 기부로 묶는다.
  const [companyCode, setCompanyCode] = useState("");
  const [companyCodeStatus, setCompanyCodeStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  // 처음 기업으로 등록하면 서버가 관리 코드를 발급한다. 다음 화면으로 넘어가기 전에 보여준다.
  const [issued, setIssued] = useState<{ code: string; next: string } | null>(null);

  async function loadCompanyByCode() {
    if (!companyCode.trim()) return;
    setCompanyCodeStatus("checking");
    const res = await fetch("/api/companies/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: companyCode }),
    }).catch(() => null);
    if (!res?.ok) return setCompanyCodeStatus("error");
    const { company } = await res.json();
    setCompanyName(company.name ?? "");
    setCompanyManager(company.manager ?? "");
    setCompanyContact(company.contact ?? "");
    setCompanyCodeStatus("ok");
  }
  const companyReady =
    donorType === "individual" ||
    (companyName.trim().length > 0 && isValidPhone(companyContact));

  // 사진을 올리기 전에 먼저 고른다. 유통기한을 물어봐야 하는지가 여기서 갈린다.
  const [kind, setKind] = useState<ItemKind | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [expiryPreview, setExpiryPreview] = useState<string | null>(null);

  // 사진을 바꾸거나 지울 때는 handleFileSelected/handleClearSlot 안에서 이전 URL을
  // 정리하지만, 등록을 마치고 이 페이지를 벗어날 때(unmount)는 그 코드가 안 불린다.
  // 마지막으로 떠 있던 미리보기 URL을 여기서 마저 해제한다.
  useEffect(() => {
    return () => {
      if (productPreview) URL.revokeObjectURL(productPreview);
    };
  }, [productPreview]);
  useEffect(() => {
    return () => {
      if (expiryPreview) URL.revokeObjectURL(expiryPreview);
    };
  }, [expiryPreview]);
  const [recognizeStatus, setRecognizeStatus] =
    useState<RecognizeStatus>("idle");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  /*
    타이핑 중에는 빈 칸을 허용해야 한다. 매 키 입력마다 1로 되돌리면 필드를 지울 수 없고,
    지운 자리에 강제로 들어간 1 뒤에 이어 쳐서 "12"가 "112"가 된다. 그래서 입력 중에는
    ""를 그대로 두고, 포커스가 빠질 때와 서버로 보낼 때 정상 범위로 다듬는다.
  */
  const [quantity, setQuantity] = useState<number | "">(1);
  // 기업은 박스로 낼 수 있다. 그때 quantity는 박스 수이고, 서버에는 낱개 총 개수로 보낸다.
  const [packUnit, setPackUnit] = useState<"개" | "박스">("개");
  const [packSize, setPackSize] = useState<number | "">(20);
  const usesBox = donorType === "company" && packUnit === "박스";
  const packSizeValue = packSize === "" ? 1 : packSize;
  const quantityValue = (quantity === "" ? 1 : quantity) * (usesBox ? packSizeValue : 1);
  const countValue = quantity === "" ? 1 : quantity;
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  // 기한이 "없는 품목"인지 "아직 모르는 것"인지 구분한다. 날짜 하나로는 못 나타낸다.
  const [expiryKnown, setExpiryKnown] = useState<"has" | "none">("has");
  const [manufacturedOn, setManufacturedOn] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  /** manual: 사진 없이(또는 AI 판독 없이) 기부자가 직접 입력한 경우. */
  const [source, setSource] = useState<"openai" | "mock" | "manual" | null>(
    null,
  );
  /** 목업으로 떨어진 이유. 서버가 알려준다 — 한도 초과와 연결 실패는 할 말이 다르다. */
  const [failure, setFailure] = useState<RecognizeFailure | null>(null);
  /**
   * 판독 때 모델이 뽑아준 물건 일반명("백미 5kg" → "쌀"). 매칭에서 같은 물건인지
   * 볼 때 쓴다.
   *
   * 어느 품목명에서 나온 값인지 함께 들고 있는다. 사용자가 품목명을 고치면 그
   * 일반명은 더 이상 맞지 않는다 — 백미를 찍었다가 "현미 2kg"으로 고쳤는데
   * 일반명이 "쌀"로 남으면, 매칭이 현미 요청을 "바로 그 물건"으로 착각한다.
   */
  const [generic, setGeneric] = useState<{
    forItemName: string;
    name: string;
  } | null>(null);
  const genericName =
    generic && generic.forItemName === itemName ? generic.name : null;
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [submittingDonation, setSubmittingDonation] = useState(false);
  const [loadingDemoPhoto, setLoadingDemoPhoto] = useState(false);
  const productFileRef = useRef<File | null>(null);
  const expiryFileRef = useRef<File | null>(null);

  /*
    서버가 최종 판정하지만, 사용자가 유통기한을 고치면 즉시 반영되도록 같은 규칙을
    로컬에서도 돌린다. 상태는 화면에서 다시 계산한다 — 기한 없는 품목이라고 체크했으면
    none, 날짜가 제대로 들어와 있으면 read, 그 밖에는 아직 모르는 것(unknown)이다.
    빈 문자열도 unknown으로 떨어져야 한다. 예전에는 그게 "기한 없음"으로 통과했다.
  */
  const expiryStatus: ExpiryStatus =
    kind === "nonfood" || expiryKnown === "none"
      ? "none"
      : expiryDate && isValidISODate(expiryDate)
        ? "read"
        : "unknown";

  const verdict: ShareVerdict | null =
    recognizeStatus === "done"
      ? evaluateShareable(expiryDate, expiryStatus)
      : null;

  const canGoNext = Boolean(
    itemName && category && quantity !== "" && verdict?.shareable,
  );

  function handleFileSelected(slot: PhotoSlotKey, selected: File | undefined) {
    if (!selected) return;

    const ref = slot === "product" ? productFileRef : expiryFileRef;
    const setPreview =
      slot === "product" ? setProductPreview : setExpiryPreview;
    ref.current = selected;
    // 앞서 만든 blob URL은 놔두면 새 사진을 고를 때마다 쌓인다.
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(selected);
    });

    // 사진이 바뀌면 이전 판독 결과는 무효다.
    setRecognizeStatus("idle");
    setItemName("");
    setGeneric(null);
    setCategory("");
    setExpiryDate(null);
    setExpiryKnown("has");
    setManufacturedOn(null);
    setConfidence(null);
    setSource(null);
    setRegisterError(null);
  }

  /** 대분류가 바뀌면 세부분류와 기한 판단의 전제가 달라진다. 판독 결과를 버린다. */
  function handleKindChange(next: ItemKind) {
    if (next === kind) return;
    setKind(next);
    setRecognizeStatus("idle");
    setItemName("");
    setGeneric(null);
    setCategory("");
    setExpiryDate(null);
    setExpiryKnown("has");
    setManufacturedOn(null);
    setConfidence(null);
    setSource(null);
    setRegisterError(null);
  }

  function handleClearSlot(slot: PhotoSlotKey) {
    const ref = slot === "product" ? productFileRef : expiryFileRef;
    const setPreview =
      slot === "product" ? setProductPreview : setExpiryPreview;
    ref.current = null;
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setRecognizeStatus("idle");
    setRegisterError(null);
  }

  /** 발표 중 파일 탐색기를 여는 대신 번들된 사진 두 장을 두 슬롯에 바로 넣는다. */
  async function handleUseDemoPhoto() {
    setLoadingDemoPhoto(true);
    try {
      for (const slot of ["product", "expiry"] as const) {
        const { src, fileName } = DEMO_PHOTOS[slot];
        const res = await fetch(src);
        if (!res.ok) throw new Error(`demo photo fetch failed: ${slot}`);
        const blob = await res.blob();
        handleFileSelected(
          slot,
          new File([blob], fileName, { type: blob.type || "image/jpeg" }),
        );
      }
    } catch {
      setRegisterError("예시 사진을 불러오지 못했어요");
    } finally {
      setLoadingDemoPhoto(false);
    }
  }

  async function handleRecognize() {
    // 사진이 없으면 막지 않고 직접 입력 카드를 연다. 사진은 선택이다.
    if (!productFileRef.current) {
      handleManualEntry();
      return;
    }
    setRegisterError(null);
    setRecognizeStatus("loading");
    try {
      const formData = new FormData();
      formData.append("image", productFileRef.current);
      if (kind) formData.append("kind", kind);
      if (expiryFileRef.current)
        formData.append("expiryImage", expiryFileRef.current);

      const res = await fetch("/api/recognize", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        // 서버가 이유를 적어 보내면(물품을 못 찾음, 사진이 너무 큼) 그 문장을 그대로 쓴다.
        const body = await res.json().catch(() => null);
        setRecognizeStatus("error");
        setRegisterError(
          body?.error ?? "AI 인식에 실패했어요. 다시 시도해주세요",
        );
        return;
      }
      const data = await res.json();

      setItemName(data.itemName);
      setCategory(data.category);
      setExpiryDate(data.expiryDate);
      // 서버가 "기한 없는 품목"이라고 한 경우에만 체크 상태로 둔다. 못 읽은 건 체크가 아니다.
      setExpiryKnown(data.expiryStatus === "none" ? "none" : "has");
      setManufacturedOn(data.manufacturedOn ?? null);
      setConfidence(data.confidence);
      setSource(data.source ?? null);
      setFailure(data.failure ?? null);
      setGeneric(
        data.genericName
          ? { forItemName: data.itemName, name: data.genericName }
          : null,
      );
      setRecognizeStatus("done");
    } catch {
      setRecognizeStatus("error");
      setRegisterError("AI 인식에 실패했어요. 다시 시도해주세요");
    }
  }

  /**
   * 사진이 없거나 AI 판독이 안 될 때(한도 초과, 연결 실패) 쓰는 길.
   * 판독 결과 카드를 빈 값으로 열어 기부자가 직접 채운다. 사진은 있으면 같이
   * 등록에 실리고, 없으면 없는 대로 등록된다 — 사진이 등록을 막을 이유는 없다.
   */
  function handleManualEntry() {
    setRegisterError(null);
    setItemName("");
    setGeneric(null);
    setCategory("");
    setExpiryDate(null);
    setExpiryKnown("has");
    setManufacturedOn(null);
    setConfidence(null);
    setSource("manual");
    setFailure(null);
    setRecognizeStatus("done");
  }

  async function handleRegisterNext() {
    setSubmittingDonation(true);
    const [productImageUrl, expiryImageUrl] = await Promise.all([
      productFileRef.current
        ? resizeImageToDataUrl(productFileRef.current)
        : Promise.resolve(null),
      expiryFileRef.current
        ? resizeImageToDataUrl(expiryFileRef.current)
        : Promise.resolve(null),
    ]);
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemName,
        category,
        quantity: quantityValue,
        ...(usesBox && packSizeValue >= 2 && { packing: { unit: "박스", size: packSizeValue } }),
        // "기한 없는 품목"에 체크했으면 남아 있는 날짜는 보내지 않는다.
        expiryDate: expiryStatus === "none" ? null : expiryDate,
        region: DEFAULT_REGION,
        genericName,
        productImageUrl,
        expiryImageUrl,
        ...(donorType === "company" && {
          donorType,
          donorName: companyName.trim(),
          donorManager: companyManager.trim(),
          donorContact: companyContact,
          ...(companyCodeStatus === "ok" && { companyCode }),
        }),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setSubmittingDonation(false);
      setRegisterError(body?.error ?? "등록에 실패했어요. 다시 시도해주세요");
      return;
    }
    const created = await res.json();

    // 게시판에서 특정 요청을 보고 들어온 경우, 매칭 추천 화면을 건너뛰고 바로 그 신청 화면으로 간다.
    // from=board는 신청 화면이 "매칭 결과로 돌아가기"처럼, 거치지도 않은 화면으로 안내하지 않게 하는 표시다.
    const next = presetNeedId
      ? `/apply?donationId=${created.id}&needId=${presetNeedId}&quantity=${created.quantity}&from=board`
      : // 2단계는 별도 주소다. 물품 id만 넘기면 그쪽에서 매칭을 다시 불러온다.
        `/match/${created.id}`;
    if (created.companyCode) {
      setIssued({ code: created.companyCode, next });
      return;
    }
    router.push(next);
  }

  /**
   * 입력 카드를 닫고 사진 단계로 돌아간다. 사진은 그대로 둔다 —
   * 품목명을 잘못 적어서 다시 하는 건데 사진까지 지우면 다시 올려야 한다.
   */
  function handleBackToPhotos() {
    setRecognizeStatus("idle");
    setItemName("");
    setGeneric(null);
    setCategory("");
    setQuantity(1);
    setExpiryDate(null);
    setExpiryKnown("has");
    setManufacturedOn(null);
    setConfidence(null);
    setSource(null);
    setFailure(null);
    setRegisterError(null);
  }

  function handleRestart() {
    handleClearSlot("product");
    handleClearSlot("expiry");
    setRecognizeStatus("idle");
    setItemName("");
    setGeneric(null);
    setCategory("");
    setQuantity(1);
    setExpiryDate(null);
    setExpiryKnown("has");
    setManufacturedOn(null);
    setConfidence(null);
    setSource(null);
    setFailure(null);
    setRegisterError(null);
  }

  if (issued) {
    return <IssuedCompanyCode code={issued.code} companyName={companyName.trim()} onNext={() => router.push(issued.next)} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href={presetNeedId ? "/board" : "/"}
        className={`${btnGhost} -mb-2 self-start`}
      >
        {presetNeedId ? "← 게시판으로 돌아가기" : "← 처음으로 돌아가기"}
      </Link>

      <header className="text-center">
        <h1 className={pageTitle}>나눔할 물품을 등록해주세요</h1>
        <p className={pageDesc}>
          제품 사진과 유통기한 사진을 각각 올려주세요.
          <br />한 면에 다 보이면 제품 사진만으로도 됩니다.
          <br />사진이 없으면 직접 입력해도 돼요
        </p>
      </header>

      {presetNeed && (
        <p className="rounded-xl border border-primary-300 bg-primary-50 px-4 py-3 text-center text-[13px] font-semibold text-primary-700">
          지금 {presetNeed.beneficiaryName}의 {presetNeed.itemName} 요청에
          채워질 물품을 등록해요
        </p>
      )}

      {/*
        기업·단체는 결과 보고서와 수거 일정 때문에 이름·연락처가 필요하다.
        매칭 화면에서는 배분기관에 맡기기 카드가 이 정보로 채워진 채 나온다.
      */}
      <div className="flex flex-col gap-2">
        {donorParam === "company" ? (
          /*
            헤더의 "기업 등록"으로 들어오면 이미 기업이라고 고른 것이다. 개인/기업 선택지를
            다시 보여주지 않고, 기업·단체로 등록 중이라는 표시만 남긴다.
          */
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary-500 bg-primary-50 px-3 py-1.5 text-[14px] font-bold text-primary-700">
            <BuildingIcon />
            기업·단체
          </p>
        ) : (
          <>
            <p className={label}>누가 기부하나요?</p>
            <div className="flex gap-2" role="radiogroup" aria-label="기부자 유형">
              {(
                [
                  ["individual", "개인"],
                  ["company", "기업·단체"],
                ] as const
              ).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={donorType === key}
                  onClick={() => setDonorType(key)}
                  className={
                    "h-12 flex-1 cursor-pointer rounded-xl border-2 text-[15px] font-bold transition-colors " +
                    (donorType === key
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400")
                  }
                >
                  {text}
                </button>
              ))}
            </div>
          </>
        )}
        {donorType === "company" ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-primary-200 bg-white/70 p-4">
            <p className="text-[13px] leading-relaxed text-neutral-600">
              여러 개를 한 번에 기부하신다면 가까운 배분기관에 맡기는 걸 추천해요. 맡은 시설에
              필요한 만큼 나눠 드리고, 어디에 몇 개 갔는지 결과 보고서로 정리해 드려요
            </p>
            <div className="flex flex-col gap-1.5 rounded-xl bg-neutral-50 p-3">
              <p className="text-[13px] font-bold text-neutral-700">기업 관리 코드가 있나요?</p>
              <div className="flex gap-2">
                <input
                  value={companyCode}
                  onChange={(e) => {
                    setCompanyCode(e.target.value.toUpperCase());
                    setCompanyCodeStatus("idle");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && loadCompanyByCode()}
                  placeholder="예: ABCD-2345"
                  aria-label="기업 관리 코드"
                  maxLength={9}
                  className={`${field} flex-1 font-mono tracking-wider`}
                />
                <button
                  type="button"
                  onClick={loadCompanyByCode}
                  disabled={!companyCode.trim() || companyCodeStatus === "checking"}
                  className="h-12 shrink-0 cursor-pointer rounded-xl bg-neutral-900 px-4 text-[14px] font-bold text-white disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  {companyCodeStatus === "checking" ? "확인 중" : "불러오기"}
                </button>
              </div>
              <p
                className={
                  "text-xs " +
                  (companyCodeStatus === "ok"
                    ? "font-bold text-primary-700"
                    : companyCodeStatus === "error"
                      ? "text-danger-fg"
                      : "text-neutral-400")
                }
              >
                {companyCodeStatus === "ok"
                  ? "확인했어요. 이 기부는 같은 기업의 기부 내역에 함께 쌓여요"
                  : companyCodeStatus === "error"
                    ? "이 코드로 등록된 기업이 없어요. 처음이면 비워 두세요"
                    : "처음이면 비워 두세요. 등록하면 관리 코드를 바로 드려요"}
              </p>
            </div>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="기업·단체 이름 (보고서에 들어가요)"
              aria-label="기업·단체 이름"
              maxLength={40}
              className={field}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={companyManager}
                onChange={(e) => setCompanyManager(e.target.value)}
                placeholder="담당자 이름 (선택)"
                aria-label="담당자 이름"
                maxLength={20}
                className={`${field} sm:flex-1`}
              />
              <input
                value={companyContact}
                onChange={(e) => setCompanyContact(e.target.value.replace(/\D/g, ""))}
                placeholder="담당자 연락처 (숫자만)"
                aria-label="담당자 연락처"
                inputMode="tel"
                maxLength={11}
                className={`${field} sm:flex-1`}
              />
            </div>
            <p className="text-xs text-neutral-400">
              연락처는 배분기관만 볼 수 있고, 수거 일정을 잡을 때만 써요
            </p>
          </div>
        ) : null}
      </div>

      {/*
        사진보다 먼저 고른다. 이 선택이 세부분류 목록과 유통기한 입력 여부를 정하고,
        모델에게도 같이 넘어가서 엉뚱한 분류를 고르지 않게 한다.
      */}
      <div className="flex flex-col gap-2">
        <p className={label}>어떤 물품인가요?</p>
        <div className="flex gap-2">
          {(["food", "nonfood"] as const).map((k) => (
            <button
              key={k}
              onClick={() => handleKindChange(k)}
              className={
                "h-12 flex-1 cursor-pointer rounded-xl border-2 text-[15px] font-bold transition-colors " +
                (kind === k
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400")
              }
            >
              {ITEM_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          {kind === "nonfood"
            ? "세제·화장지 같은 생활용품이에요. 유통기한은 묻지 않아요"
            : kind === "food"
              ? "먹는 물품이라 유통기한을 확인해요"
              : "먼저 골라주세요. 유통기한을 확인할지가 달라져요"}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/60 p-5">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <PhotoSlot
            slot="product"
            title="제품 사진"
            requirement="선택"
            hint="있으면 AI가 품목명을 읽어줘요"
            preview={productPreview}
            onSelect={handleFileSelected}
            onClear={handleClearSlot}
          />
          <PhotoSlot
            slot="expiry"
            title="유통기한 사진"
            requirement="선택"
            hint="날짜가 또렷하게 보이게"
            preview={expiryPreview}
            onSelect={handleFileSelected}
            onClear={handleClearSlot}
          />
        </div>

        <div className="flex w-full">
          <button
            onClick={handleUseDemoPhoto}
            disabled={loadingDemoPhoto}
            className={btnOutline}
          >
            {loadingDemoPhoto ? "불러오는 중..." : "예시 사진 불러오기 (2장)"}
          </button>
        </div>

        <button
          onClick={handleRecognize}
          disabled={recognizeStatus === "loading" || kind === null}
          className={btnPrimary}
        >
          {kind === null
            ? "먼저 음식 여부를 골라주세요"
            : recognizeStatus === "loading"
              ? "사진에서 품목과 유통기한을 읽는 중..."
              : !productPreview
                ? "사진 없이 직접 입력하기"
                : expiryPreview
                  ? "AI로 확인하기 (사진 2장)"
                  : "AI로 확인하기"}
        </button>

        {registerError && (
          <p className="text-center text-[13px] text-danger-fg">
            {registerError}
          </p>
        )}

        {/*
          사진이 없거나 AI가 막혔을 때의 출구. 사진 유무와 상관없이 늘 보인다 —
          판독이 실패한 뒤에 이 버튼이 숨어 있으면 기부자는 할 수 있는 게 없다.
        */}
        {productPreview && (
          <button
            onClick={handleManualEntry}
            disabled={kind === null || recognizeStatus === "loading"}
            className={btnGhost}
          >
            AI 없이 직접 입력하기
          </button>
        )}
      </div>

      {recognizeStatus === "done" && verdict && (
        <div className={card}>
          {/*
            목업으로 떨어졌을 때는 카드 맨 위에서 먼저 말한다.
            아래 뱃지가 "나눔 가능"을 확신에 차서 보여주는데, 그 판정의 근거가
            가짜 데이터라는 걸 뱃지보다 먼저 읽혀야 오해가 안 생긴다.
          */}
          {source === "mock" && (
            <div className="flex flex-col gap-1 rounded-xl border-2 border-warning-fg/40 bg-warning-bg px-4 py-3">
              <p className="break-keep text-[15px] font-extrabold text-warning-fg">
                {failureCopy(failure).title}
              </p>
              <p className="break-keep text-[13px] leading-relaxed text-warning-fg">
                {failureCopy(failure).detail} 아래 내용은 실제 판독 결과가
                아니라 <b>예시 데이터</b>예요. 품목명과 유통기한이 사진과 맞는지
                직접 확인하고 고쳐주세요.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">
              {source === "manual" ? "물품 정보 입력" : "AI 인식 결과"}
            </h2>
            <span className={toneBadge(verdict.tone)}>
              {TONE_LABEL[verdict.tone]}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>품목명</label>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="예: 아침에주스 오렌지 210mL"
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>
              세부분류{kind ? ` · ${ITEM_KIND_LABEL[kind]}` : ""}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={field}
            >
              <option value="" disabled>
                카테고리를 선택하세요
              </option>
              {(kind ? categoriesFor(kind) : CATEGORIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/*
            개수는 여기서 묻는다. 사진에 찍힌 물건이 몇 개인지는 기부자만 알고,
            어느 기관에 낼지 고르기 전에 이미 정해져 있는 값이다. 요청별 남은 목표라는
            진짜 상한은 이 화면에서 알 수 없어서 매칭·신청 화면에서 다시 좁힌다.
          */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className={label} htmlFor="donation-qty">
                {usesBox ? "박스 수" : "개수"}
              </label>
              {donorType === "company" && (
                <div className="flex gap-1" role="radiogroup" aria-label="수량 단위">
                  {(["개", "박스"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={packUnit === u}
                      onClick={() => setPackUnit(u)}
                      className={
                        "h-8 cursor-pointer rounded-full border px-3 text-[13px] font-bold " +
                        (packUnit === u
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 bg-white text-neutral-500")
                      }
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(clampQuantity(countValue - 1))}
                disabled={countValue <= 1}
                aria-label="개수 줄이기"
                className="size-11 shrink-0 cursor-pointer rounded-xl border-2 border-neutral-300 bg-white text-[18px] font-bold text-neutral-700 transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-300"
              >
                −
              </button>
              <input
                id="donation-qty"
                type="number"
                min={1}
                max={MAX_DONATION_QUANTITY}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    e.target.value === "" ? "" : clampQuantity(e.target.value),
                  )
                }
                onBlur={() => setQuantity(countValue)}
                className={`${field} text-center`}
              />
              <button
                onClick={() => setQuantity(clampQuantity(countValue + 1))}
                disabled={countValue >= MAX_DONATION_QUANTITY}
                aria-label="개수 늘리기"
                className="size-11 shrink-0 cursor-pointer rounded-xl border-2 border-neutral-300 bg-white text-[18px] font-bold text-neutral-700 transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-300"
              >
                +
              </button>
            </div>
            {usesBox && (
              <div className="flex items-center gap-2">
                <label htmlFor="pack-size" className="shrink-0 text-[13px] font-bold text-neutral-600">
                  한 박스에
                </label>
                <input
                  id="pack-size"
                  type="number"
                  min={2}
                  max={MAX_PACK_SIZE}
                  value={packSize}
                  onChange={(e) =>
                    setPackSize(
                      e.target.value === ""
                        ? ""
                        : Math.min(MAX_PACK_SIZE, Math.max(1, Math.floor(Number(e.target.value) || 1))),
                    )
                  }
                  onBlur={() => setPackSize(Math.max(2, packSizeValue))}
                  className={`${field} w-24! shrink-0 text-center`}
                />
                <span className="shrink-0 text-[13px] font-bold text-neutral-600">개씩</span>
                <span className="ml-auto shrink-0 whitespace-nowrap text-[13px] font-bold text-primary-700">
                  총 {quantityValue.toLocaleString()}개
                </span>
              </div>
            )}
          </div>

          {/* 먹는 물품이 아니면 유통기한 자체를 묻지 않는다. 기부자가 대분류에서 이미 답했다. */}
          {kind !== "nonfood" && (
            <div className="flex flex-col gap-1.5">
              <label className={label}>유통기한</label>

              {/*
                날짜를 확인하지 못했으면 그 사실을 먼저 말한다. 예전에는 이 경우가
                "유통기한 없는 품목"으로 조용히 넘어가서 그대로 나눔 가능이 됐다.
                제조일자만 찍힌 라벨이 대표적인 경우라, 읽은 제조일자를 근거로 같이 보여준다.
              */}
              {verdict.needsExpiryInput && source === "manual" && (
                <p className="text-[13px] leading-relaxed text-neutral-500">
                  포장에 적힌 유통기한을 입력해주세요. 없는 품목이면 아래를
                  체크해주세요.
                </p>
              )}
              {verdict.needsExpiryInput && source !== "manual" && (
                <div className="flex flex-col gap-1 rounded-xl border-2 border-warning-fg/40 bg-warning-bg px-4 py-3">
                  <p className="text-[14px] font-extrabold text-warning-fg">
                    유통기한을 확인하지 못했어요
                  </p>
                  <p className="text-[13px] leading-relaxed text-warning-fg">
                    {manufacturedOn
                      ? `포장에서 제조일자(${formatKoreanDate(manufacturedOn)})만 찾았어요. 제조일자로는 유통기한을 알 수 없으니, 포장에 적힌 유통기한을 직접 입력해주세요.`
                      : "포장에서 날짜를 찾지 못했어요. 유통기한이 보이면 직접 입력하고, 없는 품목이면 아래를 체크해주세요."}
                  </p>
                </div>
              )}

              <input
                type="date"
                value={expiryDate ?? ""}
                disabled={expiryKnown === "none"}
                onChange={(e) => setExpiryDate(e.target.value || null)}
                className={`${field} disabled:bg-neutral-50 disabled:text-neutral-400`}
              />
              <label className="flex items-center gap-2 text-[13px] text-neutral-500">
                <input
                  type="checkbox"
                  checked={expiryKnown === "none"}
                  onChange={() => {
                    // 이벤트 값 대신 현재 상태를 뒤집는다. 날짜 입력을 비우는 것도
                    // 같은 분기에서 처리해 체크와 날짜가 어긋나지 않게 한다.
                    // 날짜는 지우지 않는다 — 실수로 체크했다 풀면 입력한 날짜가 그대로 돌아온다.
                    // 체크된 동안은 expiryStatus가 "none"이라 날짜는 판정·등록에 쓰이지 않는다.
                    setExpiryKnown(expiryKnown === "none" ? "has" : "none");
                  }}
                  className="size-4 cursor-pointer accent-primary-700"
                />
                유통기한이 없는 품목이에요
              </label>
            </div>
          )}

          <p className={`text-[13px] font-bold ${TONE_TEXT[verdict.tone]}`}>
            {verdict.reason}
          </p>
          {confidence !== null && (
            <p className="text-xs text-neutral-400">
              AI 신뢰도 {Math.round(confidence * 100)}%
            </p>
          )}

          {/* 입력이 필요한 상태는 나눔 불가가 아니다. 다른 물품을 권하면 안 된다. */}
          {!verdict.shareable && !verdict.needsExpiryInput && (
            <button
              onClick={handleRestart}
              className={`${btnDanger} h-12 w-full`}
            >
              다른 물품 등록하기
            </button>
          )}

          <button
            onClick={handleBackToPhotos}
            className={`${btnGhost} mx-auto`}
          >
            ← 사진 단계로 돌아가기
          </button>
        </div>
      )}

      {canGoNext && !companyReady && (
        <p className="-mb-2 text-center text-[13px] text-danger-fg">
          맨 위 기업·단체 정보(이름, 담당자 연락처)를 채워주세요
        </p>
      )}
      <button
        disabled={!canGoNext || !companyReady || submittingDonation}
        onClick={handleRegisterNext}
        className={btnSecondary}
      >
        {submittingDonation
          ? "등록 중..."
          : presetNeedId
            ? "다음: 신청 정보 입력"
            : "다음: 매칭 결과 확인"}
      </button>
    </div>
  );
}

/** 제품 사진 / 유통기한 사진 슬롯. 둘이 완전히 같은 구조라 컴포넌트로 뺐다. */
function PhotoSlot({
  slot,
  title,
  requirement,
  hint,
  preview,
  onSelect,
  onClear,
}: {
  slot: PhotoSlotKey;
  title: string;
  requirement: string;
  hint: string;
  preview: string | null;
  onSelect: (slot: PhotoSlotKey, file: File | undefined) => void;
  onClear: (slot: PhotoSlotKey) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-bold text-neutral-700">
          {title}
          <span className="ml-1.5 text-xs font-bold text-neutral-400">
            {requirement}
          </span>
        </p>
        {preview && (
          <button onClick={() => onClear(slot)} className={btnGhost}>
            지우기
          </button>
        )}
      </div>

      {preview ? (
        <img
          src={preview}
          alt={`업로드한 ${title} 미리보기`}
          className="aspect-4/3 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-1 rounded-xl bg-white/70 px-3 text-center">
          <p className="text-[13px] text-neutral-400">아직 없어요</p>
          <p className="text-xs text-neutral-400">{hint}</p>
        </div>
      )}

      {/*
        PC에서는 촬영 버튼을 감춘다. 화면 폭이 아니라 포인터 종류로 가른다 —
        터치스크린 노트북도 주 입력이 마우스면 pointer: fine이라 PC로 잡히고,
        브라우저 창을 좁혀도 휴대폰 취급을 받지 않는다.
        CSS로만 가르니 서버 렌더링과 어긋날 일도, 처음 한 번 깜빡일 일도 없다.
        버튼 이름도 같이 바꾼다. PC에서 "갤러리"는 뜻이 안 통한다.
      */}
      <div className="flex gap-2">
        <button
          onClick={() => galleryRef.current?.click()}
          className={btnOutlineCompact}
        >
          <span className="pointer-coarse:hidden">파일 선택</span>
          <span className="hidden pointer-coarse:inline">갤러리</span>
        </button>
        {/*
          btnOutline에 inline-flex가 들어 있어서 같은 요소에 hidden을 얹으면
          display가 충돌해 숨겨지지 않는다. display 유틸리티가 없는 래퍼로 감싼다.
        */}
        <span className="hidden flex-1 pointer-coarse:flex">
          <button
            onClick={() => cameraRef.current?.click()}
            className={btnOutlineCompact}
          >
            촬영
          </button>
        </span>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          onSelect(slot, e.target.files?.[0]);
          // 같은 파일을 다시 골라도 change가 나게 value를 비운다.
          e.target.value = "";
        }}
        className="hidden"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          onSelect(slot, e.target.files?.[0]);
          // 같은 파일을 다시 골라도 change가 나게 value를 비운다.
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

/** 기업·단체 표시용 건물 아이콘. 글자 크기에 맞춰 1em. */
function BuildingIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-[1.1em]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 9h2a2 2 0 0 1 2 2v10" />
      <path d="M3 21h18" />
      <path d="M8 7h4M8 11h4M8 15h4" />
    </svg>
  );
}

/**
 * 처음 기업으로 등록했을 때 한 번 보여주는 관리 코드. 서버는 해시만 남겨서 다시 볼 수 없다 —
 * 그래서 복사 버튼을 두고, 넘어가기 전에 적어 두라고 분명히 말한다.
 */
function IssuedCompanyCode({ code, companyName, onNext }: { code: string; companyName: string; onNext: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>기업 관리 코드가 나왔어요</h1>
        <p className={pageDesc}>
          {companyName ? `${companyName}의 ` : ""}기부를 이 코드로 모아서 관리해요
        </p>
      </header>
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary-500 bg-white p-6">
        <p className="font-mono text-[32px] font-extrabold tracking-[0.12em] text-neutral-900">{code}</p>
        <button
          type="button"
          onClick={copy}
          className="h-10 cursor-pointer rounded-full border border-neutral-300 bg-white px-4 text-[14px] font-bold text-neutral-700"
        >
          {copied ? "복사했어요" : "코드 복사"}
        </button>
      </div>
      <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-neutral-700">
        <li>· <strong>신청 조회 → 기업</strong>에서 이 코드로 맡긴 물품이 어디까지 갔는지 봐요</li>
        <li>· 다음에 기부할 때 이 코드를 넣으면 같은 기업 기부로 이어져요</li>
        <li className="text-danger-fg">· 코드는 지금만 보여드려요. 꼭 적어 두거나 복사해 두세요</li>
      </ul>
      <button type="button" onClick={onNext} className={btnPrimary}>
        다음으로
      </button>
    </div>
  );
}
