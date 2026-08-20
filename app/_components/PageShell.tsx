import { shell } from "../ui";

/** 랜딩을 제외한 일반 페이지들의 공통 폭·여백. 데모 데이터 안내는 필요한 곳에서만 켠다. */
export default function PageShell({
  children,
  showDisclaimer = false,
}: {
  children: React.ReactNode;
  showDisclaimer?: boolean;
}) {
  return (
    <main className="flex flex-col items-center px-5 py-10 md:px-6 lg:px-8 xl:px-10">
      <div className={shell}>
        {showDisclaimer && (
          <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-neutral-400">
            데모 화면입니다 · 입력한 데이터는 서버에 저장되지 않아 일정 시간 뒤 초기 상태로 돌아갑니다
          </p>
        )}
        {children}
      </div>
    </main>
  );
}
