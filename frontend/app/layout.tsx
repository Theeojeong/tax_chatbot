import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Do_Hyeon, Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "../components/ThemeProvider";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const dohyeon = Do_Hyeon({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dohyeon",
});

export const metadata: Metadata = {
  title: "세무톡",
  description: "소득세법과 부동산세법을 학습한 챗봇이 상담을 도와드립니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${grotesk.variable} ${fraunces.variable} ${dohyeon.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
