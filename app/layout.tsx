// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "네이버 핫템 셀러 레이더",
  description: "검색 기반 셀러 인사이트",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}