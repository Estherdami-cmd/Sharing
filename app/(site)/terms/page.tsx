import Link from "next/link";
import PageShell from "@/app/_components/PageShell";
import { caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";

export default function TermsPage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="text-center">
          <h1 className={pageTitle}>이용약관</h1>
          <p className={pageDesc}>
            해커톤 데모 프로젝트의 안내 문구예요. 정식 서비스의 약관이 아니에요.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <section>
            <h2 className={sectionTitle}>1. 서비스 소개</h2>
            <p className={`${caption} mt-1`}>
              여러시는 기관의 필요 물품 등록과 개인의 나눔 신청을 연결하는 데모 서비스예요.
              실제 결제·배송·법적 책임이 발생하지 않아요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>2. 데이터 보관</h2>
            <p className={`${caption} mt-1`}>
              입력한 정보는 데이터베이스에 저장되고, 지울 때까지 보관돼요. 자세한 내용은{" "}
              <Link href="/privacy" className="font-bold text-primary-700 hover:text-primary-800">
                개인정보처리방침
              </Link>
              을 확인해주세요.
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
