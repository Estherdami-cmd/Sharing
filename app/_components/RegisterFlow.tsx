"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  CATEGORIES,
  DEFAULT_REGION,
  SAMPLE_ITEMS,
  type ExpiryStatus,
  type ShareVerdict,
  evaluateShareable,
  formatKoreanDate,
  isValidISODate,
} from "@/lib/rules";
import {
  TONE_LABEL,
  TONE_TEXT,
  btnDanger,
  btnGhost,
  btnOutline,
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
 * 1단계: 물품 등록.
 * 등록에 성공하면 만들어진 물품 id를 쿼리에 실어 2단계 주소로 넘긴다.
 * 사진 파일은 이 페이지에서만 쓰고 서버로 보내지 않으므로 다음 단계로 넘길 것이 없다.
 */
export default function RegisterFlow() {
  const router = useRouter();

  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [expiryPreview, setExpiryPreview] = useState<string | null>(null);
  const [recognizeStatus, setRecognizeStatus] = useState<RecognizeStatus>("idle");
  const [demoSample, setDemoSample] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  // 기한이 "없는 품목"인지 "아직 모르는 것"인지 구분한다. 날짜 하나로는 못 나타낸다.
  const [expiryKnown, setExpiryKnown] = useState<"has" | "none">("has");
  const [manufacturedOn, setManufacturedOn] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [source, setSource] = useState<"demo" | "openai" | "mock" | null>(null);
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
    expiryKnown === "none" ? "none" : expiryDate && isValidISODate(expiryDate) ? "read" : "unknown";

  const verdict: ShareVerdict | null =
    recognizeStatus === "done" ? evaluateShareable(expiryDate, expiryStatus) : null;

  const canGoNext = Boolean(itemName && category && verdict?.shareable);

  function handleFileSelected(slot: PhotoSlotKey, selected: File | undefined) {
    if (!selected) return;

    const ref = slot === "product" ? productFileRef : expiryFileRef;
    const setPreview = slot === "product" ? setProductPreview : setExpiryPreview;
    ref.current = selected;
    // 앞서 만든 blob URL은 놔두면 새 사진을 고를 때마다 쌓인다.
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(selected);
    });

    // 사진이 바뀌면 이전 판독 결과는 무효다.
    setRecognizeStatus("idle");
    setItemName("");
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
    const setPreview = slot === "product" ? setProductPreview : setExpiryPreview;
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
        handleFileSelected(slot, new File([blob], fileName, { type: blob.type || "image/jpeg" }));
      }
      // 예시 사진은 실제 AI가 읽는 걸 보여주는 용도라 데모 모드 지정은 풀어준다.
      setDemoSample("");
    } catch {
      setRegisterError("예시 사진을 불러오지 못했어요");
    } finally {
      setLoadingDemoPhoto(false);
    }
  }

  async function handleRecognize() {
    if (!productFileRef.current) {
      setRegisterError("먼저 제품 사진을 올려주세요");
      return;
    }
    setRegisterError(null);
    setRecognizeStatus("loading");
    try {
      const formData = new FormData();
      formData.append("image", productFileRef.current);
      if (expiryFileRef.current) formData.append("expiryImage", expiryFileRef.current);
      if (demoSample) formData.append("sample", demoSample);

      const res = await fetch("/api/recognize", { method: "POST", body: formData });
      if (!res.ok) {
        // 서버가 이유를 적어 보내면(물품을 못 찾음, 사진이 너무 큼) 그 문장을 그대로 쓴다.
        const body = await res.json().catch(() => null);
        setRecognizeStatus("error");
        setRegisterError(body?.error ?? "AI 인식에 실패했어요. 다시 시도해주세요");
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
      setRecognizeStatus("done");
    } catch {
      setRecognizeStatus("error");
      setRegisterError("AI 인식에 실패했어요. 다시 시도해주세요");
    }
  }

  async function handleRegisterNext() {
    setSubmittingDonation(true);
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName, category, expiryDate, region: DEFAULT_REGION }),
    });
    if (!res.ok) {
      setSubmittingDonation(false);
      setRegisterError("등록에 실패했어요. 다시 시도해주세요");
      return;
    }
    const created = await res.json();
    // 2단계는 별도 주소다. 물품 id만 넘기면 그쪽에서 매칭을 다시 불러온다.
    router.push(`/match/${created.id}`);
  }

  function handleRestart() {
    handleClearSlot("product");
    handleClearSlot("expiry");
    setRecognizeStatus("idle");
    setDemoSample("");
    setItemName("");
    setCategory("");
    setExpiryDate(null);
    setExpiryKnown("has");
    setManufacturedOn(null);
    setConfidence(null);
    setSource(null);
    setRegisterError(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>나눔할 물품을 등록해주세요</h1>
        <p className={pageDesc}>
          제품 사진과 유통기한 사진을 각각 올려주세요. 한 면에 다 보이면 제품 사진만으로도 됩니다
        </p>
      </header>

      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/60 p-5">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <PhotoSlot
            slot="product"
            title="제품 사진"
            requirement="필수"
            hint="품목명과 용량이 보이게"
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
          <button onClick={handleUseDemoPhoto} disabled={loadingDemoPhoto} className={btnOutline}>
            {loadingDemoPhoto ? "불러오는 중..." : "예시 사진 불러오기 (2장)"}
          </button>
        </div>

        <button
          onClick={handleRecognize}
          disabled={recognizeStatus === "loading"}
          className={btnPrimary}
        >
          {recognizeStatus === "loading"
            ? "사진에서 품목과 유통기한을 읽는 중..."
            : expiryPreview
              ? "AI로 확인하기 (사진 2장)"
              : "AI로 확인하기"}
        </button>

        <div className="w-full">
          <label className="mb-1.5 block text-xs font-bold text-neutral-400">데모 모드</label>
          <select
            value={demoSample}
            onChange={(e) => setDemoSample(e.target.value)}
            className={field}
          >
            <option value="">자동 인식 (사진 기준)</option>
            {SAMPLE_ITEMS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {registerError && <p className="text-center text-[13px] text-danger-fg">{registerError}</p>}
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
              <p className="text-[15px] font-extrabold text-warning-fg">
                AI 서버에 연결하지 못했어요
              </p>
              <p className="text-[13px] leading-relaxed text-warning-fg">
                아래 내용은 실제 판독 결과가 아니라 <b>예시 데이터</b>예요. 품목명과 유통기한이
                사진과 맞는지 직접 확인하고 고쳐주세요.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">AI 인식 결과</h2>
            <span className={toneBadge(verdict.tone)}>{TONE_LABEL[verdict.tone]}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>품목명</label>
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} className={field} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>카테고리</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              <option value="" disabled>
                카테고리를 선택하세요
              </option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={label}>유통기한</label>

            {/*
              날짜를 확인하지 못했으면 그 사실을 먼저 말한다. 예전에는 이 경우가
              "유통기한 없는 품목"으로 조용히 넘어가서 그대로 나눔 가능이 됐다.
              제조일자만 찍힌 라벨이 대표적인 경우라, 읽은 제조일자를 근거로 같이 보여준다.
            */}
            {verdict.needsExpiryInput && (
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
                onChange={(e) => {
                  setExpiryKnown(e.target.checked ? "none" : "has");
                  if (e.target.checked) setExpiryDate(null);
                }}
                className="size-4 accent-primary-700"
              />
              유통기한이 없는 품목이에요
            </label>
          </div>

          <p className={`text-[13px] font-bold ${TONE_TEXT[verdict.tone]}`}>{verdict.reason}</p>
          {confidence !== null && (
            <p className="text-xs text-neutral-400">
              AI 신뢰도 {Math.round(confidence * 100)}%
              {source === "demo" && " · 데모 모드로 지정한 결과예요"}
            </p>
          )}

          {/* 입력이 필요한 상태는 나눔 불가가 아니다. 다른 물품을 권하면 안 된다. */}
          {!verdict.shareable && !verdict.needsExpiryInput && (
            <button onClick={handleRestart} className={`${btnDanger} h-12 w-full`}>
              다른 물품 등록하기
            </button>
          )}
        </div>
      )}

      <button
        disabled={!canGoNext || submittingDonation}
        onClick={handleRegisterNext}
        className={btnSecondary}
      >
        {submittingDonation ? "등록 중..." : "다음: 매칭 결과 확인"}
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
          <span className="ml-1.5 text-xs font-bold text-neutral-400">{requirement}</span>
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
        <button onClick={() => galleryRef.current?.click()} className={`${btnOutline} h-11`}>
          <span className="pointer-coarse:hidden">파일 선택</span>
          <span className="hidden pointer-coarse:inline">갤러리</span>
        </button>
        {/*
          btnOutline에 inline-flex가 들어 있어서 같은 요소에 hidden을 얹으면
          display가 충돌해 숨겨지지 않는다. display 유틸리티가 없는 래퍼로 감싼다.
        */}
        <span className="hidden flex-1 pointer-coarse:flex">
          <button onClick={() => cameraRef.current?.click()} className={`${btnOutline} h-11`}>
            촬영
          </button>
        </span>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={(e) => onSelect(slot, e.target.files?.[0])}
        className="hidden"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onSelect(slot, e.target.files?.[0])}
        className="hidden"
      />
    </div>
  );
}
