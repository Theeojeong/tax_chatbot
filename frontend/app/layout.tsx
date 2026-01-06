import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "부동산세금톡",
  description: "종합부동산세법과 소득세법을 학습한 챗봇이 상담을 도와드립니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${grotesk.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
