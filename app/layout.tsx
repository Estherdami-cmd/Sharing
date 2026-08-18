import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포항 푸드뱅크 매칭",
  description: "물품 사진을 올리면 포항시 푸드뱅크 필요 품목과 매칭해주는 기부 서비스",
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
