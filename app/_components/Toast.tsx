"use client";

/**
 * 화면 하단에 잠깐 떴다 사라지는 알림. 새로고침 같은 "방금 한 행동이 실제로
 * 뭔가 했다"는 확인을 조용히 주기 위한 용도라, 사용자가 직접 누른 동작에만
 * 붙이고 배경에서 자동으로 도는 새로고침(포커스 복귀 등)에는 쓰지 않는다.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type ToastTone = "success" | "error";
type ToastState = { id: number; message: string; tone: ToastTone } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, showToast };
}

export function ToastViewport({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        className={
          "animate-fade-in-up pointer-events-auto rounded-full px-5 py-3 text-[14px] font-bold text-white shadow-lg " +
          (toast.tone === "error" ? "bg-danger-fg" : "bg-neutral-900")
        }
      >
        {toast.message}
      </div>
    </div>
  );
}
