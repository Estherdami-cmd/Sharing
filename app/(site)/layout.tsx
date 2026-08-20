import Footer from "@/app/_components/Footer";
import Header from "@/app/_components/Header";

/** 랜딩·기부·신청·게시판·정보 페이지가 공유하는 공통 레이아웃.
 * /foodbank는 시연용 단독 화면이라 이 그룹 밖에 둔다(헤더·푸터 없음). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
