import PageShell from "@/app/_components/PageShell";
import { caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";
import { SOURCES } from "@/lib/opendata";
import { ORG_COUNT } from "@/lib/store";

const STEPS: { src: string; step: string; desc: string }[] = [
  { src: "/service/register.png", step: "1. 물품 등록", desc: "사진 올리면 AI가 품목·유통기한을 읽어요" },
  { src: "/service/match.png", step: "2. 매칭 확인", desc: "지금 가장 필요한 곳을 추천받아요" },
  { src: "/service/apply.png", step: "3. 나눔 신청", desc: "수량과 가능한 날짜를 골라요" },
  { src: "/service/complete.png", step: "4. 신청 완료", desc: "기관이 날짜를 확정하면 끝나요" },
];

/**
 * 흰 배경 카드로 감싸지 않는다 — 사진 옆에 흰 블록이 따로 떠 보이는 걸 없애려고
 * 뺐다. 사진은 그 자체로 둥근 모서리를 갖고, 글은 배경 없이 사진 옆에 놓인다.
 */
const mediaRow = "flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5";
const mediaImg = "rounded-xl object-cover object-top";

export default function ServicePage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="text-center">
          <h1 className={pageTitle}>여러시는 이렇게 동작해요</h1>
          <p className={pageDesc}>
            기관이 먼저 "이 물건이 이만큼 필요해요"를 올리고, 개인이 사진 한 장으로 그 목표를
            나눠 채우는 서비스예요.
          </p>
        </header>

        {/* 세 섹션 모두 사진:글 = 2:1 비율로 나눈다. */}
        <div className={mediaRow}>
          <img
            src="/service/board.png"
            alt="진행 현황 게시판. 기관별 요청이 목표 수량 대비 몇 % 채워졌는지 진행률로 보여준다"
            className={`${mediaImg} h-64 w-full sm:h-auto sm:min-w-0 sm:flex-[2]`}
          />
          <div className="flex flex-col gap-2 sm:flex-1">
            <h2 className={sectionTitle}>왜 이렇게 만들었나요</h2>
            <p className={caption}>
              게시판에 물건을 올려두고 기관이 일일이 골라가는 방식은 모니터링 부담이 크고, 한
              기관이 몰아가는 허점이 있었어요. 크라우드펀딩식으로 여럿이 나눠 채우는 구조로
              뒤집었습니다.
            </p>
          </div>
        </div>

        <div className={mediaRow}>
          {/*
            화면 4개짜리 띠도 같은 방식으로 왼쪽(모바일은 위쪽)에 둔다. 세로로
            쌓으면(sm:flex-col) 오른쪽 글 옆에 빈 공간만 길게 남아서, 폭을 좁게
            고정하고 가로 줄은 그대로 유지한다.
          */}
          <div className="flex w-full gap-2 overflow-x-auto sm:min-w-0 sm:flex-[2]">
            {/*
              여기도 admin.png처럼 object-cover 대신 object-contain을 써서 사진을
              잘라내지 않는다. 4장 각자 원래 비율 그대로 박스 안에 다 들어가고,
              가로로 넘겨보는 스크롤 형태는 그대로 유지한다.
            */}
            {/* "왜 이렇게 만들었나요" 사진(board.png)과 같은 크기(435px 폭)로 4장 다 맞춘다. */}
            {STEPS.map((s) => (
              <img
                key={s.step}
                src={s.src}
                alt={`${s.step} 화면 — ${s.desc}`}
                className="h-64 w-full shrink-0 rounded-xl object-contain object-top sm:h-auto sm:w-[435px]"
              />
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-1">
            <h2 className={sectionTitle}>기부자는 4단계만 거치면 돼요</h2>
            <p className={caption}>
              제품 사진(과 필요하면 유통기한 사진)을 올리면 AI가 품목과 유통기한을 읽고, 지금
              가장 필요한 곳을 추천해드려요. 수량과 전달 가능한 날짜를 고르면 신청 끝.
            </p>
          </div>
        </div>

        <div className={mediaRow}>
          <img
            src="/service/admin.png"
            alt="기관 관리 화면. 필요 물품을 올리는 폼과 들어온 신청 목록을 함께 보여준다"
            /* 이 사진만 거의 정사각형이라, 다른 사진처럼 h-auto로 두면 옆 사진들보다
               훨씬 커져버린다. 높이를 다른 사진들과 비슷하게 고정하고, 잘라내는
               object-cover 대신 object-contain으로 잘림 없이 다 보이게 한다. */
            className="h-64 w-full rounded-xl object-contain object-top sm:min-w-0 sm:flex-[2]"
          />
          <div className="flex flex-col gap-2 sm:flex-1">
            <h2 className={sectionTitle}>기관은 목표만 올려두면 돼요</h2>
            <p className={caption}>
              필요한 물품과 목표 수량을 등록해두면, 여러 기부자가 나눠서 채워줘요. 들어온 신청을
              확인하고 수락·거절만 하면 됩니다.
            </p>
          </div>
        </div>

        {/*
          화면에 뜨는 기관은 지어낸 데이터가 아니라 공공데이터포털에서 받아온 실제
          기관이다. 그 사실이 서비스를 이해하는 데 필요한 정보라, 푸터에 작게 적어두는
          대신 이 페이지에서 밝힌다.
        */}
        <section className="flex flex-col gap-3 border-t border-neutral-200/70 pt-8">
          <div>
            <h2 className={sectionTitle}>기관 정보는 공공데이터를 씁니다</h2>
            <p className={`${caption} mt-1`}>
              화면에 나오는 기관 {ORG_COUNT}곳은 지어낸 데이터가 아니라 공공데이터포털에서
              받아온 실제 기관이에요. 이름·주소·좌표를 그대로 씁니다.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {SOURCES.map((src) => (
              <li
                key={src.dataset}
                className="break-keep rounded-xl border border-neutral-200/70 bg-white px-4 py-3"
              >
                <a
                  href={src.datasetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[15px] font-semibold text-primary-700 underline decoration-primary-700/30 underline-offset-2 hover:text-primary-800"
                >
                  {src.dataset}
                </a>
                <p className={`${caption} mt-0.5`}>
                  {src.covers}
                  {src.collectedAt ? ` · ${src.collectedAt} 수집 기준` : ""}
                </p>
              </li>
            ))}
          </ul>

          <p className={caption}>
            기관 운영시간과 연락처는 원본 데이터에 없는 항목이에요. 없는 정보를 지어내지 않으려고
            표시하지 않고, 전달 시간은 신청 후 기관과 협의하도록 안내합니다.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
