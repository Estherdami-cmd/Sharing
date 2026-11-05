import PageShell from "@/app/_components/PageShell";
import { caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";

export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="text-center">
          <h1 className={pageTitle}>개인정보처리방침</h1>
          <p className={pageDesc}>
            해커톤 데모 프로젝트의 안내 문구예요. 정식 서비스의 개인정보처리방침이 아니에요.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <section>
            <h2 className={sectionTitle}>1. 수집하는 정보</h2>
            <p className={`${caption} mt-1`}>
              물품을 등록하고 나눔을 신청할 때 입력하는 사진·품목·유통기한·수량·전달 장소·연락처가
              데이터베이스에 저장돼요. 기관과 신청을 연결하는 데에만 써요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>2. 보관 기간</h2>
            <p className={`${caption} mt-1`}>
              자동으로 삭제되지 않고, 지울 때까지 보관돼요. 삭제를 원하면{" "}
              <a href="mailto:yeoreosi@gmail.com" className="font-bold text-primary-700 hover:text-primary-800">
                yeoreosi@gmail.com
              </a>
              으로 알려주세요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>3. 외부 서비스</h2>
            <p className={`${caption} mt-1`}>
              데이터는 Google Firebase에 저장돼요. 사진을 판독하고 품목명을 정리할 때는 사진과
              품목명이 OpenAI로 전송돼요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>4. 입력할 때 주의할 점</h2>
            <p className={`${caption} mt-1`}>
              데모 단계라 저장된 정보의 접근 제한이 완전하지 않아요. 실제 전화번호나 민감한 정보는
              입력하지 말고, 체험할 때는 가짜 번호를 써주세요.
            </p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
