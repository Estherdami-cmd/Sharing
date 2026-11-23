import PageShell from "@/app/_components/PageShell";
import { caption, pageDesc, pageTitle, sectionTitle } from "@/app/ui";
import { SOURCES } from "@/lib/opendata";
import { ORG_COUNT, PARTNER_BENEFICIARIES } from "@/lib/store";

/**
 * 서비스 소개. 멘토 4차 피드백("현장에서 기부가 막히는 곳은 가운데 배분기관이다")을 반영한
 * 개발팀 공유 자료(2026-11-23)의 흐름을 그대로 따른다:
 * 문제(보관·폐기·서류의 짐) → 구조(두 경로, 같은 필요 목록) → 누가 무엇을 쓰나 → AI → 데이터 출처.
 */

/** 배분기관 안에서 물품 하나에 붙는 일. 위는 지금의 짐, 아래는 여러시가 덜어주는 방법. */
const BURDENS: { step: string; burden: string; relief: string }[] = [
  { step: "접수·검수", burden: "무엇이 몇 개, 언제까지인지 직원이 하나하나 확인", relief: "사진 AI가 품목·수량·기한 초안" },
  { step: "보관", burden: "줄 곳이 정해질 때까지 창고에 쌓아 둠", relief: "손든 시설로 바로 배분" },
  { step: "배분", burden: "시설마다 연락해 필요를 묻고, 나누고, 실어 보냄", relief: "시설 후보·전달 일정 한 화면에서" },
  { step: "증빙·보고", burden: "기업마다 다른 양식에 사진·서류를 매번 새로", relief: "장부·결과 보고서 자동 작성" },
];

type Role = {
  key: string;
  name: string;
  who: string;
  points: string[];
  shots: { src: string; alt: string }[];
};

const ROLES: Role[] = [
  {
    key: "hub",
    name: "배분기관",
    who: "푸드뱅크·푸드마켓·NGO처럼 기부를 받아 여러 시설에 나누는 곳",
    points: [
      "맡은 시설 여러 곳의 필요와 들어온 물품을 대시보드 한 화면에서 봐요",
      "기업·개인이 맡긴 물품을 받을 기준과 비교해 승인하거나 반려해요",
      "보관 물품은 남은 기한이 짧은 순으로, 시설별 수량을 나눠 배분해요",
      "전달 날짜 후보를 보내면 시설이 고르거나 다른 날을 요청해요",
      "입고와 배분이 그대로 모집·제공 장부가 돼요",
    ],
    shots: [
      { src: "/service/hub-dashboard.jpg", alt: "배분기관 대시보드. 담당 시설 수, 진행 중 목표, 입고 대기, 보관 물품 수와 입고 대기 목록" },
      { src: "/service/hub-distribute.jpg", alt: "배분하기 화면. 받을 시설에 수량을 나누고 전달 날짜 후보를 고른다" },
    ],
  },
  {
    key: "facility",
    name: "시설",
    who: "지역아동센터·노인복지센터·무료급식소 같은 최종 수혜기관",
    points: [
      "지금처럼 필요한 물품과 목표 수량을 올려요. 누구나 보는 공개 목록이 돼요",
      "개인 기부 신청은 기준과 비교해 수락하고, 받은 뒤 확인해요",
      "배분기관이 나눠 준 물품은 '받을 물품'에서 따로 모아 날짜를 골라요",
    ],
    shots: [{ src: "/service/facility-deliveries.jpg", alt: "시설의 받을 물품 화면. 배분기관이 보낸 날짜 후보 중 하나를 고른다" }],
  },
  {
    key: "company",
    name: "기업",
    who: "사회공헌·ESG 담당자",
    points: [
      "'기업 등록'으로 기업 이름과 담당자 연락처를 함께 남겨요",
      "필요한 시설에 직접 주거나, 가까운 배분기관에 맡기기 버튼 하나로 넘겨요",
      "어느 시설에 몇 개 갔는지 결과 보고서로 받아 지속가능경영보고서 실적·증빙에 써요",
    ],
    shots: [{ src: "/service/company-register.jpg", alt: "기부하기 화면에서 기업·단체를 고르고 기업 이름과 담당자 연락처를 입력한다" }],
  },
  {
    key: "individual",
    name: "개인",
    who: "집에 남는 물품을 나누고 싶은 누구나",
    points: [
      "사진을 올리면 AI가 품목·유통기한을 읽고, 지금 필요한 시설을 추천해요",
      "수량과 전달 가능한 날짜를 골라 시설에 직접 신청해요",
      "배분기관에 맡기는 길은 그 기관의 기준(품목·수량·남은 기한)에 맞을 때만 열려요",
    ],
    shots: [{ src: "/service/individual-register.jpg", alt: "개인 기부 물품 등록 화면. 사진을 올리면 AI가 품목과 유통기한을 읽는다" }],
  },
];

/** 지금 되는 것과 준비 중인 것을 섞지 않고 나눠 적는다. */
const AI_USES: { name: string; what: string; who: string; ready: boolean }[] = [
  { name: "사진 AI", what: "사진에서 품목·수량·유통기한을 읽어 등록 초안을 만들어요", who: "개인·기업·배분기관", ready: true },
  { name: "기준 대조", what: "받을 곳의 기준과 비교해 맞는 시설·기한 임박 물품을 먼저 추천해요", who: "개인·기업·배분기관", ready: true },
  { name: "장부 자동 작성", what: "입고 승인과 배분 확정이 그대로 모집·제공 장부 한 줄이 돼요", who: "배분기관", ready: true },
  { name: "기업 양식 채우기", what: "기업이 올린 수령 확인서·활용 보고서를 AI가 읽고, 시설은 빈칸만 채우면 그 양식대로 문서가 나와요", who: "기업·시설", ready: true },
];

const sectionHead = "flex flex-col gap-1";
const box = "rounded-2xl border border-neutral-200/70 bg-white p-4";

export default function ServicePage() {
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-14">
        <header className="text-center">
          <h1 className={`${pageTitle} break-keep`}>마음이, 끝까지 닿도록</h1>
          <p className={`${pageDesc} break-keep`}>
            여러시는 기부 물품이 곧바로 필요한 곳에 닿게 돕고, 배분기관에는 여러 시설의 수요·수령·배분을
            관리하는 일을 줄여주는 서비스예요.
          </p>
        </header>

        {/* 1. 문제 */}
        <section className="flex flex-col gap-4">
          <div className={sectionHead}>
            <h2 className={`${sectionTitle} break-keep`}>좋은 마음이 현장에서는 짐이 되고 있었어요</h2>
            <p className={`${caption} break-keep`}>
              포항의 아동센터·복지관·NGO를 만나 보니, 들어온 물품은 보관하고 버리고 서류를 만드는 일로
              바뀌고 있었어요. 그 일이 가장 많이 쌓이는 곳은 기부를 받아 여러 시설에 나누는 배분기관이에요.
            </p>
          </div>
          <ol className="grid gap-2 sm:grid-cols-4">
            {BURDENS.map((b, i) => (
              <li key={b.step} className={`${box} flex flex-col gap-2`}>
                <p className="text-[12px] font-bold text-neutral-400">{i + 1}</p>
                <p className="text-[15px] font-bold text-neutral-900">{b.step}</p>
                <p className={`${caption} break-keep`}>{b.burden}</p>
                <p className="mt-auto break-keep rounded-lg bg-primary-50 px-2.5 py-1.5 text-[12px] font-bold text-primary-700">
                  {b.relief}
                </p>
              </li>
            ))}
          </ol>
          <p className={`${caption} break-keep`}>
            제때 못 나간 물품은 기한이 지나 폐기되고, 필요 없는 물품도 후원 관계 때문에 받아 두었다 버리고,
            나눌 여력이 없으면 기부 자체를 거절하게 돼요.
          </p>
        </section>

        {/* 2. 구조 */}
        <section className="flex flex-col gap-4">
          <div className={sectionHead}>
            <h2 className={`${sectionTitle} break-keep`}>모두가 같은 필요 목록을 봐요</h2>
            <p className={`${caption} break-keep`}>
              시설이 올린 필요는 개인·기업·배분기관 누구나 봐요. 물품이 시설에 닿는 길은 두 가지예요.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={`${box} flex flex-col gap-1.5`}>
              <p className="text-[12px] font-bold text-neutral-500">경로 ① 직접</p>
              <p className="break-keep text-[15px] font-bold text-neutral-900">기업·개인 → 시설</p>
              <p className={`${caption} break-keep`}>필요 목록에서 시설을 골라 직접 신청해요.</p>
            </div>
            <div className={`${box} flex flex-col gap-1.5 border-primary-500/40`}>
              <p className="text-[12px] font-bold text-primary-700">경로 ② 배분기관에 맡기기</p>
              <p className="break-keep text-[15px] font-bold text-neutral-900">
                기업·개인 → 배분기관 → 여러 시설
              </p>
              <p className={`${caption} break-keep`}>
                입고 승인 → 보관 → 시설별 수량 배분 → 전달 일정까지 배분기관이 한 흐름으로 끝내요.
              </p>
            </div>
          </div>
        </section>

        {/* 3. 누가 무엇을 쓰나 */}
        <section className="flex flex-col gap-8">
          <div className={sectionHead}>
            <h2 className={`${sectionTitle} break-keep`}>기능은 같고, 쓰는 범위만 달라요</h2>
            <p className={`${caption} break-keep`}>
              시설은 자기 것 하나로, 배분기관은 맡은 시설 전체로 같은 기관 관리 기능을 써요.
            </p>
          </div>
          {ROLES.map((role) => (
            <article key={role.key} className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <div className="flex flex-col gap-2 sm:w-64 sm:shrink-0">
                <h3 className="text-lg font-extrabold text-neutral-900">{role.name}</h3>
                <p className={`${caption} break-keep`}>{role.who}</p>
                <ul className="flex flex-col gap-1.5">
                  {role.points.map((p) => (
                    <li key={p} className="flex gap-2 break-keep text-[14px] leading-relaxed text-neutral-700">
                      <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-primary-600" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              {/* 화면은 모바일 폭으로 찍었다. 같은 높이 틀에 위쪽부터 맞춰 넣어 나란히 둔다. */}
              <div className="flex min-w-0 flex-1 items-start gap-3 overflow-x-auto pb-1">
                {role.shots.map((s) => (
                  <img
                    key={s.src}
                    src={s.src}
                    alt={s.alt}
                    loading="lazy"
                    className="h-[260px] w-52 shrink-0 rounded-xl border border-neutral-200/70 bg-white object-cover object-top sm:h-[280px] sm:w-56"
                  />
                ))}
              </div>
            </article>
          ))}
        </section>

        {/* 4. AI */}
        <section className="flex flex-col gap-4">
          <div className={sectionHead}>
            <h2 className={`${sectionTitle} break-keep`}>AI는 읽고, 대조하고, 초안을 써요</h2>
            <p className={`${caption} break-keep`}>
              실물 확인·수령 승인·배분 순서·기부금 영수증 발급은 기관이 해요. AI는 그 앞의 손이 많이 가는
              일을 덜어요.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {AI_USES.map((a) => (
              <li key={a.name} className={`${box} flex flex-col gap-1.5`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-bold text-neutral-900">{a.name}</p>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                      (a.ready ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-500")
                    }
                  >
                    {a.ready ? "지금 써요" : "준비 중"}
                  </span>
                </div>
                <p className={`${caption} break-keep`}>{a.what}</p>
                <p className="text-[12px] font-bold text-neutral-400">{a.who}</p>
              </li>
            ))}
          </ul>
        </section>

        {/*
          화면에 뜨는 기관은 지어낸 데이터가 아니라 공공데이터포털에서 받아온 실제
          기관이다. 그 사실이 서비스를 이해하는 데 필요한 정보라, 푸터에 작게 적어두는
          대신 이 페이지에서 밝힌다.
        */}
        <section className="flex flex-col gap-4 border-t border-neutral-200/70 pt-10">
          <div className={sectionHead}>
            <h2 className={sectionTitle}>기관 정보는 어디서 오나요</h2>
            <p className={`${caption} break-keep`}>
              화면에 나오는 기관 {ORG_COUNT}곳은 지어낸 데이터가 아니라 공공데이터포털에서 받아온 실제
              기관이에요. 이름·주소·좌표를 그대로 씁니다.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {SOURCES.map((src) => (
              <li key={src.dataset} className={`${box} break-keep py-3`}>
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

          <p className={`${caption} break-keep`}>
            공공데이터에는 운영 시간과 연락처가 없어서 지어내지 않고 비워 둬요. 전달 날짜는 신청이나 배분
            뒤에 기관끼리 화면에서 주고받아 정해요.
          </p>

          {PARTNER_BENEFICIARIES.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <h3 className="text-[15px] font-bold text-neutral-900">직접 등록한 배분기관</h3>
              <p className={`${caption} break-keep`}>공공데이터에 없어 여러시가 직접 더한 기관이에요.</p>
              <ul className="flex flex-col gap-2">
                {PARTNER_BENEFICIARIES.map((org) => (
                  <li key={org.id} className={`${box} break-keep py-3`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-neutral-900">{org.name}</p>
                      <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-bold text-danger-fg">
                        {org.category} 배분기관
                      </span>
                    </div>
                    <p className={`${caption} mt-0.5`}>{org.address}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
