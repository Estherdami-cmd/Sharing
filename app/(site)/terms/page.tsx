import PageShell from "@/app/_components/PageShell";
import { caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";

export default function TermsPage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="text-center">
          <h1 className={pageTitle}>이용약관</h1>
          <p className={pageDesc}>
            이 페이지는 데모 프로젝트용 안내 문구예요. 실제 서비스 약관이 아니에요.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <section>
            <h2 className={sectionTitle}>1. 서비스 소개</h2>
            <p className={`${caption} mt-1`}>
              나눔곳간은 기관의 필요 물품 등록과 개인의 나눔 신청을 연결하는 데모 서비스예요.
              실제 결제·배송·법적 책임이 발생하지 않아요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>2. 데이터 보관</h2>
            <p className={`${caption} mt-1`}>
              입력한 정보는 서버 메모리에만 저장되며, 서버가 재시작되면 초기화돼요. 실제 개인정보
              수집·보관 목적으로 사용되지 않아요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>3. 변경</h2>
            <p className={`${caption} mt-1`}>
              데모 화면 구성에 따라 이 문서의 내용은 사전 고지 없이 바뀔 수 있어요.
            </p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
