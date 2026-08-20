import PageShell from "@/app/_components/PageShell";
import { card, caption, pageDesc, pageTitle, label } from "@/app/ui";

export default function ContactPage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="text-center">
          <h1 className={pageTitle}>문의하기</h1>
          <p className={pageDesc}>서비스 이용 중 궁금한 점이나 제안하고 싶은 내용을 알려주세요</p>
        </header>

        <div className={card}>
          <div>
            <p className={label}>이메일</p>
            <p className="mt-1 text-[15px]">contact@nanumgotgan.example</p>
          </div>
          <div>
            <p className={label}>운영 시간</p>
            <p className="mt-1 text-[15px]">평일 10:00 ~ 18:00 (주말·공휴일 제외)</p>
          </div>
          <p className={caption}>데모 프로젝트라 실제 응답은 어려워요. 양해 부탁드려요.</p>
        </div>
      </div>
    </PageShell>
  );
}
