"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    router.replace(token ? "/chat" : "/login");
  }, [router]);

  return (
    <div className="page-shell">
      <div className="auth-card">
        <h1>TaxRoute 준비 중...</h1>
        <p>세금 상담을 위한 라우팅 챗봇을 불러오는 중입니다.</p>
      </div>
    </div>
  );
}
