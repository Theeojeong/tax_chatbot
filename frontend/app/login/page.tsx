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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        const buttonDiv = document.getElementById("google-signin-button");
        if (buttonDiv) {
          const width = buttonDiv.clientWidth;
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
            width: width ? width + "" : "100%", // -10px 제거
            text: "signin_with",
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
    setLoading(true);

    try {
      const payload = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
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
          <h1>만나서 반가워요.</h1>
          <p>
            부동산세법과 소득세법을 학습한 챗봇에 로그인해 대화를 이어가세요.
          </p>
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
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="auth-divider">
              <span>또는</span>
            </div>
            <div
              id="google-signin-button"
              className="google-button-wrapper"
            ></div>
          </>
        )}

        <Link className="secondary" href="/signup">
          아직 계정이 없나요? 가입하기
        </Link>
      </form>
    </div>
  );
}
