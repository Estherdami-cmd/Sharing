import type { Metadata } from "next";
import "./globals.css";

const TITLE = "사진 한 장이면 필요한 곳이 채워집니다 — 나눔곳간";
const DESCRIPTION =
  "기관이 필요한 물품과 수량을 먼저 올리면, 사진 한 장으로 여럿이 나눠 그 목표를 채우는 나눔 서비스";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "나눔곳간",
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
      <body>{children}</body>
    </html>
  );
}
