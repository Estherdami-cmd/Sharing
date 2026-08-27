import PageShell from "@/app/_components/PageShell";
import { caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";

const STEPS: { src: string; step: string; desc: string }[] = [
  { src: "/service/register.png", step: "1. 물품 등록", desc: "사진 올리면 AI가 품목·유통기한을 읽어요" },
  { src: "/service/match.png", step: "2. 매칭 확인", desc: "지금 가장 필요한 곳을 추천받아요" },
  { src: "/service/apply.png", step: "3. 나눔 신청", desc: "수량과 가능한 날짜를 골라요" },
  { src: "/service/complete.png", step: "4. 신청 완료", desc: "기관이 날짜를 확정하면 끝나요" },
];

/** 사진이 카드 안 작은 썸네일로 끼어있지 않고, 카드 가장자리까지 꽉 차게 빠져나온다. */
const mediaCard =
  "flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white sm:flex-row";

export default function ServicePage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="text-center">
          <h1 className={pageTitle}>여러시는 이렇게 동작해요</h1>
          <p className={pageDesc}>
            기관이 먼저 "이 물건이 이만큼 필요해요"를 올리고, 개인이 사진 한 장으로 그 목표를
            나눠 채우는 서비스예요.
          </p>
        </header>

        <div className={mediaCard}>
          <img
            src="/service/board.png"
            alt="진행 현황 게시판. 기관별 요청이 목표 수량 대비 몇 % 채워졌는지 진행률로 보여준다"
            className="h-40 w-full object-cover object-top sm:h-auto sm:w-52 sm:shrink-0"
          />
          <div className="flex flex-col gap-2 p-5">
            <h2 className={sectionTitle}>왜 이렇게 만들었나요</h2>
            <p className={caption}>
              게시판에 물건을 올려두고 기관이 일일이 골라가는 방식은 모니터링 부담이 크고, 한
              기관이 몰아가는 허점이 있었어요. 크라우드펀딩식으로 여럿이 나눠 채우는 구조로
              뒤집었습니다.
            </p>
          </div>
        </div>

        <div className={mediaCard}>
          {/*
            화면 4개짜리 띠도 같은 방식으로 왼쪽(모바일은 위쪽) 가장자리에 붙여 뺀다.
            세로로 쌓으면(sm:flex-col) 오른쪽 글 옆에 빈 공간만 길게 남아서, 폭을 좁게
            고정하고 가로 줄은 그대로 유지한다.
          */}
          <div className="flex w-full gap-2 overflow-x-auto sm:w-52 sm:shrink-0">
            {STEPS.map((s) => (
              <div key={s.step} className="relative w-36 shrink-0">
                <img
                  src={s.src}
                  alt={`${s.step} 화면 — ${s.desc}`}
                  className="h-28 w-full object-cover object-top"
                />
                <p className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-bold text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_70%)]">
                  {s.step}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 p-5">
            <h2 className={sectionTitle}>기부자는 4단계만 거치면 돼요</h2>
            <p className={caption}>
              제품 사진(과 필요하면 유통기한 사진)을 올리면 AI가 품목과 유통기한을 읽고, 지금
              가장 필요한 곳을 추천해드려요. 수량과 전달 가능한 날짜를 고르면 신청 끝.
            </p>
          </div>
        </div>

        <div className={mediaCard}>
          <img
            src="/service/admin.png"
            alt="기관 관리 화면. 필요 물품을 올리는 폼과 들어온 신청 목록을 함께 보여준다"
            className="h-40 w-full object-cover object-top sm:h-auto sm:w-52 sm:shrink-0"
          />
          <div className="flex flex-col gap-2 p-5">
            <h2 className={sectionTitle}>기관은 목표만 올려두면 돼요</h2>
            <p className={caption}>
              필요한 물품과 목표 수량을 등록해두면, 여러 기부자가 나눠서 채워줘요. 들어온 신청을
              확인하고 수락·거절만 하면 됩니다.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
