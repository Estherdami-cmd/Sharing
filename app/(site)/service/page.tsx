import PageShell from "@/app/_components/PageShell";
import { card, caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";

export default function ServicePage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="text-center">
          <h1 className={pageTitle}>나눔곳간은 이렇게 동작해요</h1>
          <p className={pageDesc}>
            기관이 먼저 "이 물건이 이만큼 필요해요"를 올리고, 개인이 사진 한 장으로 그 목표를
            나눠 채우는 서비스예요.
          </p>
        </header>

        <div className={card}>
          <h2 className={sectionTitle}>왜 이렇게 만들었나요</h2>
          <p className={caption}>
            게시판에 물건을 올려두고 기관이 일일이 골라가는 방식은 모니터링 부담이 크고, 한
            기관이 몰아가는 허점이 있었어요. 크라우드펀딩식으로 여럿이 나눠 채우는 구조로
            뒤집었습니다.
          </p>
        </div>

        <div className={card}>
          <h2 className={sectionTitle}>기부자는 4단계만 거치면 돼요</h2>
          <p className={caption}>
            제품 사진(과 필요하면 유통기한 사진)을 올리면 AI가 품목과 유통기한을 읽고, 지금
            가장 필요한 곳을 추천해드려요. 수량과 전달 가능한 날짜를 고르면 신청 끝.
          </p>
        </div>

        <div className={card}>
          <h2 className={sectionTitle}>기관은 목표만 올려두면 돼요</h2>
          <p className={caption}>
            필요한 물품과 목표 수량을 등록해두면, 여러 기부자가 나눠서 채워줘요. 들어온 신청을
            확인하고 수락·거절만 하면 됩니다.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
