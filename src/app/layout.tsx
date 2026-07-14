import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2026 여주시 경기공유학교 학교맞춤형 예산관리시스템",
  description: "2026년도 여주미래교육협력지구 사업의 일환인 '경기공유학교 학교맞춤형' 예산을 모니터링하고 지원하는 시스템입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
