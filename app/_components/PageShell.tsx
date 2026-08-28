import { shell } from "../ui";

/** 랜딩을 제외한 일반 페이지들의 공통 폭·여백. */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    /*
      overflow-x-clip은 게시판 티커 때문이다. 티커는 시세판처럼 화면 끝까지 닿으려고
      좌우 음수 여백으로 컨테이너 밖까지 넓히는데, 반올림이나 스크롤바 폭 때문에 1px씩
      넘쳐 가로 스크롤이 생길 수 있다. clip으로 잘라낸다 — hidden과 달리 스크롤 컨테이너를
      만들지 않아서 바깥 헤더의 sticky가 그대로 동작한다.
    */
    <main className="flex flex-1 flex-col items-center overflow-x-clip px-5 py-10 md:px-6 lg:px-8 xl:px-10">
      <div className={shell}>{children}</div>
    </main>
  );
}
