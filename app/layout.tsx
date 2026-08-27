import type { Metadata } from "next";
import "./globals.css";

const TITLE = "사진 한 장이면 필요한 곳이 채워집니다 — 여러시";
const DESCRIPTION =
  "기관이 필요한 물품과 수량을 먼저 올리면, 사진 한 장으로 여럿이 나눠 그 목표를 채우는 나눔 서비스";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "여러시",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* 본문 폰트(Pretendard)는 구글 폰트에 없어서 CDN 스타일시트를 직접 불러온다. */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
