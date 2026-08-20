import PageShell from "@/app/_components/PageShell";
import { caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";

export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="text-center">
          <h1 className={pageTitle}>개인정보처리방침</h1>
          <p className={pageDesc}>
            이 페이지는 데모 프로젝트용 안내 문구예요. 실제 개인정보처리방침이 아니에요.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <section>
            <h2 className={sectionTitle}>1. 수집하는 정보</h2>
            <p className={`${caption} mt-1`}>
              나눔 신청 시 입력하는 연락처·전달 장소·수량 정보가 서버 메모리에 일시적으로
              저장돼요. 이 정보는 데모 화면 안에서만 쓰이고 외부로 전송되지 않아요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>2. 보관 기간</h2>
            <p className={`${caption} mt-1`}>
              서버가 재시작되면 모든 데이터가 초기화돼요. 별도의 데이터베이스나 영구 저장소를
              쓰지 않아요.
            </p>
          </section>
          <section>
            <h2 className={sectionTitle}>3. 제3자 제공</h2>
            <p className={`${caption} mt-1`}>
              사진 인식에 OpenAI API를 호출할 때만 이미지가 외부로 전송돼요. 그 외에는
              어떤 정보도 제3자에게 제공하지 않아요.
            </p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
