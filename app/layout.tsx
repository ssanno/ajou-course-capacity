import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "수강정원 예측 서비스",
  description: "학과별 교육과정과 재학생 현황으로 수강수요와 정원·분반을 계획합니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
