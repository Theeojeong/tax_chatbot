"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { apiFetch } from "../../lib/api";
import { setAuth } from "../../lib/auth";
import { GOOGLE_CLIENT_ID } from "../../lib/config";
import type { TokenResponse } from "../../lib/types";

import { Header } from "../../components/auth/Header";
import { Input } from "../../components/auth/Input";
import { BackgroundDecor } from "../../components/auth/BackgroundDecor";

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
  const [showPassword, setShowPassword] = useState(false);
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
          auto_select: false,
        });
        const buttonDiv = document.getElementById("google-signin-button");
        if (buttonDiv) {
          // Google button rendering might need adjustment to match new design style or we wrap it
          // The new design has a custom Google button style.
          // BUT Google Identity Services forces their iframe button.
          // We can use the "standard" or "icon" types, or custom implementation.
          // For now, let's keep the standard Google button but ensure it fits the container.
          // Or we can try to use a custom button and call the API programmatically if using the OAuth flow,
          // but avoiding complexity, we'll render the standard button in the new social area.
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
            width: "350", // approximate width of container
            text: "signin_with",
            locale: "ko",
            logo_alignment: "left",
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
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-sans text-slate-900 dark:text-white relative overflow-hidden">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 md:p-8 z-10">
        <div className="w-full max-w-[440px] flex flex-col items-center">
          <div className="w-full mb-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              세무톡 계정으로 로그인하세요.
            </p>
          </div>

          <div className="w-full bg-white dark:bg-[#1c2127] p-6 md:p-7 rounded-xl border border-[#e5e7eb] dark:border-[#2b3440] shadow-sm animate-in fade-in zoom-in-95 duration-500">
            <form onSubmit={handleSubmit}>
              <Input
                label="이메일 주소"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="비밀번호"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                endIcon={
                  showPassword ? <EyeOff size={20} /> : <Eye size={20} />
                }
                onEndIconClick={() => setShowPassword(!showPassword)}
              />

              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e7eb] dark:border-[#2b3440]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-[#1c2127] px-2 text-slate-500 dark:text-[#9dabb9]">
                  또는
                </span>
              </div>
            </div>

            {/* Google Sign In Container */}
            {GOOGLE_CLIENT_ID && (
              <div
                id="google-signin-button"
                className="w-full flex justify-center min-h-[44px]"
              ></div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            계정이 없으신가요?
            <Link
              href="/signup"
              className="text-primary font-semibold hover:underline ml-1"
            >
              가입하기
            </Link>
          </p>
        </div>
      </main>

      <BackgroundDecor />
    </div>
  );
}
