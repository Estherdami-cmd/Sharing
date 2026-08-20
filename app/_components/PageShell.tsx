import { shell } from "../ui";

/** 랜딩을 제외한 일반 페이지들의 공통 폭·여백. */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col items-center px-5 py-10 md:px-6 lg:px-8 xl:px-10">
      <div className={shell}>{children}</div>
    </main>
  );
}
