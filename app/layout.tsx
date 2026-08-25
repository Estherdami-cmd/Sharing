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
        {/* 본문 폰트(Gowun Batang)는 next/font/google이 한글 서브셋을 제공하지 않아
            직접 링크로 불러온다. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
