"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { btnPrimaryCompact, caption, field, label } from "../ui";

// 기관 관리 코드는 탭을 닫으면 잊는다. 공용 PC에서 다음 사람에게 남지 않게.
// 기관 화면이 여러 페이지로 나뉘어도 탭 안에서는 다시 묻지 않는다.
const ADMIN_TOKEN_KEY = "sharing.adminToken";

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 서버에 이 코드가 맞는지 묻는다. 빈 코드로 물으면 "코드가 필요한 서버인지"를 알 수 있다. */
async function verifyCode(code: string) {
  const res = await fetch("/api/admin/verify", {
    headers: code ? { "x-admin-token": code } : {},
  }).catch(() => null);
  if (!res) return { ok: false, error: "서버에 연결하지 못했어요. 다시 시도해주세요" };
  if (res.ok) return { ok: true, error: null };
  if (res.status === 401) {
    return { ok: false, error: code ? "코드가 맞지 않아요. 다시 입력해주세요" : null };
  }
  const body = await res.json().catch(() => null);
  return { ok: false, error: body?.error ?? "코드를 확인하지 못했어요" };
}

/*
 * 기관 관리 코드 상태.
 *   checking  들어오자마자 서버에 코드가 필요한지 묻는 중
 *   open      코드가 설정되지 않은 로컬 개발. 입력란을 안 보인다
 *   needed    코드가 없거나 틀렸다. 입력란을 보인다
 *   verified  맞는 코드를 넣었다. "확인됨 · 변경"으로 줄인다
 */
export function useAdminCode() {
  const tokenRef = useRef("");
  const [codeState, setCodeState] = useState<
    "checking" | "open" | "needed" | "verified"
  >("checking");
  const [verifying, setVerifying] = useState(false);
  // 동작 중에 코드가 막혔을 때만 입력란으로 데려간다. 처음 들어왔을 때 포커스를
  // 주면 모바일에서 키보드가 바로 올라와 화면을 가린다.
  const [focusRequest, setFocusRequest] = useState(0);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  // 코드 때문에 막힌 동작. 코드를 넣으면 같은 버튼을 다시 누르게 하지 않고 이어서 한다.
  const retryRef = useRef<(() => void) | null>(null);

  function storeToken(code: string) {
    tokenRef.current = code;
    try {
      if (code) sessionStorage.setItem(ADMIN_TOKEN_KEY, code);
      else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {}
  }

  useEffect(() => {
    const stored = readStoredToken();
    verifyCode(stored).then(({ ok, error }) => {
      if (ok) {
        storeToken(stored);
        setCodeState(stored ? "verified" : "open");
        return;
      }
      storeToken("");
      setCodeError(error);
      setCodeState("needed");
    });
  }, []);

  /*
   * 코드를 요구하는 버튼과 입력란이 멀리 떨어져 있을 수 있다. 옮겨 주지 않으면
   * 눌러도 아무 일이 없는 것처럼 보인다.
   */
  useEffect(() => {
    if (focusRequest === 0) return;
    const input = document.getElementById("admin-code");
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }, [focusRequest]);

  const askForCode = useCallback((retry: () => void) => {
    retryRef.current = retry;
    setCodeError(tokenRef.current ? "코드가 맞지 않아요. 다시 입력해주세요" : null);
    storeToken("");
    setCodeState("needed");
    setFocusRequest((n) => n + 1);
  }, []);

  /** 코드를 실어 보낸다. 401이면 입력란을 띄우고, 코드를 넣은 뒤 retry로 막힌 동작을 잇는다. */
  const adminFetch = useCallback(
    async (url: string, init: RequestInit, retry: () => void) => {
      const headers = new Headers(init.headers);
      if (tokenRef.current) headers.set("x-admin-token", tokenRef.current);
      const res = await fetch(url, { ...init, headers });
      if (res.status === 401) askForCode(retry);
      return res;
    },
    [askForCode],
  );

  /** 읽기용 헤더. 연락처 조회는 코드가 없어도 401이 아니라 연락처만 가린 200을 준다. */
  const authHeaders = useCallback((): HeadersInit => {
    return tokenRef.current ? { "x-admin-token": tokenRef.current } : {};
  }, []);

  async function submitCode() {
    const code = codeInput.trim();
    if (!code || verifying) return;
    setVerifying(true);
    const { ok, error } = await verifyCode(code);
    setVerifying(false);
    if (!ok) {
      setCodeError(error ?? "코드가 맞지 않아요. 다시 입력해주세요");
      return;
    }
    storeToken(code);
    setCodeInput("");
    setCodeError(null);
    setCodeState("verified");
    const retry = retryRef.current;
    retryRef.current = null;
    retry?.();
  }

  function changeCode() {
    storeToken("");
    setCodeError(null);
    setCodeState("needed");
    setFocusRequest((n) => n + 1);
  }

  return {
    codeState,
    /** 코드 확인이 끝났고, 코드를 쓸 수 있거나 코드가 필요 없는 상태. */
    codeReady: codeState === "open" || codeState === "verified",
    adminFetch,
    authHeaders,
    askForCode,
    field: {
      codeState,
      codeInput,
      setCodeInput,
      codeError,
      verifying,
      submitCode,
      changeCode,
    },
  };
}

type FieldProps = ReturnType<typeof useAdminCode>["field"];

export function AdminCodeField({
  codeState,
  codeInput,
  setCodeInput,
  codeError,
  verifying,
  submitCode,
  changeCode,
}: FieldProps) {
  if (codeState === "verified") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-neutral-500">
        <span className="font-semibold text-success-fg">✓ 관리 코드 확인됨</span>
        <button
          type="button"
          onClick={changeCode}
          className="cursor-pointer border-none bg-transparent p-0 font-bold text-primary-700 hover:text-primary-800"
        >
          변경
        </button>
      </p>
    );
  }
  if (codeState !== "needed") return null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitCode();
      }}
      className="flex flex-col gap-1.5"
    >
      <label htmlFor="admin-code" className={label}>
        관리 코드
      </label>
      <div className="flex gap-2">
        <input
          id="admin-code"
          type="password"
          autoComplete="off"
          placeholder="기관 관리 코드를 입력해주세요"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          className={`${field} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={!codeInput.trim() || verifying}
          className={`${btnPrimaryCompact} w-auto! shrink-0 px-5`}
        >
          {verifying ? "확인 중" : "확인"}
        </button>
      </div>
      {codeError ? (
        <p className="text-[13px] text-danger-fg">{codeError}</p>
      ) : (
        <p className={caption}>신청 수락·거절, 연락처 보기, 요청 등록에 필요해요</p>
      )}
    </form>
  );
}
