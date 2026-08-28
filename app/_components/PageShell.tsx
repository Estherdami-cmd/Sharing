import { shell } from "../ui";

/** 랜딩을 제외한 일반 페이지들의 공통 폭·여백. */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    /*
      overflow-x-clip은 게시판 티커 때문이다. 티커는 시세판처럼 화면 끝까지 닿으려고
      100vw를 쓰는데, 스크롤바가 폭을 차지하는 환경(윈도우 등)에서는 100vw가 뷰포트보다
      넓어 가로 스크롤이 생긴다. clip으로 잘라낸다 — hidden과 달리 스크롤 컨테이너를
      만들지 않아서 안쪽의 sticky 필터 바가 그대로 동작한다.
    */
    <main className="flex flex-col items-center overflow-x-clip px-5 py-10 md:px-6 lg:px-8 xl:px-10">
      <div className={shell}>{children}</div>
    </main>
  );
}
