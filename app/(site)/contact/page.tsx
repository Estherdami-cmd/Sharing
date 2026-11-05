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
            <a
              href="mailto:yeoreosi@gmail.com"
              className="mt-1 inline-block text-[15px] font-bold text-primary-700 hover:text-primary-800"
            >
              yeoreosi@gmail.com
            </a>
          </div>
          <p className={caption}>해커톤 프로젝트라 답변이 늦어질 수 있어요.</p>
        </div>
      </div>
    </PageShell>
  );
}
