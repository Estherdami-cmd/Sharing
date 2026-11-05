import Footer from "@/app/_components/Footer";
import Header from "@/app/_components/Header";

/** 랜딩·기부·신청·게시판·정보 페이지가 공유하는 공통 레이아웃.
 * 기관 관리(/beneficiary)도 같은 헤더·푸터를 쓴다. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="bg-drift-page" aria-hidden />
      <Header />
      {children}
      <Footer />
    </>
  );
}
