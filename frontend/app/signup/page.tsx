"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";
import { setAuth } from "../../lib/auth";
import { GOOGLE_CLIENT_ID } from "../../lib/config";
import type { TokenResponse } from "../../lib/types";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleCallback = async (response: { credential: string }) => {
    setError(null);
    setLoading(true);

    try {
      const payload = await apiFetch<TokenResponse>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential }),
      });
      setAuth(payload);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
        const buttonDiv = document.getElementById("google-signup-button");
        if (buttonDiv) {
          const width = buttonDiv.clientWidth;
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
            width: width ? width + "" : "100%", // -10px 제거
            text: "signup_with",
            locale: "ko",
          });
        }
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      const payload = await apiFetch<TokenResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
        }),
      });
      setAuth(payload);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div>
          <h1>새로운 세금 파트너.</h1>
          <p>RouteLLM 기반 멀티 에이전트와 대화를 시작하세요.</p>
        </div>
        <div>
          <label htmlFor="displayName">이름</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            placeholder="홍길동"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="8자 이상"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "8px",
              fontSize: "0.85rem",
              color:
                password.length === 0
                  ? "var(--muted)" // Gray when empty
                  : password.length >= 8 && password.length <= 32
                  ? "#2E7D32" // Green when valid
                  : "#D32F2F", // Red when invalid
              transition: "color 0.2s ease",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {password.length === 0 ||
              (password.length >= 8 && password.length <= 32) ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              )}
            </svg>
            <span>8자 이상 32자 이하 입력 (공백 제외)</span>
          </div>
        </div>
        <div>
          <label htmlFor="passwordConfirm">비밀번호 확인</label>
          <input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "가입 중..." : "회원가입"}
        </button>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="auth-divider">
              <span>또는</span>
            </div>
            <div
              id="google-signup-button"
              className="google-button-wrapper"
            ></div>
          </>
        )}

        <Link className="secondary" href="/login">
          이미 계정이 있나요? 로그인
        </Link>
      </form>
    </div>
  );
}
