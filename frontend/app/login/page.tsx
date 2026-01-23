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
        <div className="w-full max-w-[480px] flex flex-col items-center">
          {/* Header Section */}
          <div className="w-full mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6 ring-1 ring-primary/20 shadow-glow">
              {/* Use Lucide User icon or similar */}
              <svg
                className="w-10 h-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Welcome back
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Sign in to your account to continue chatting
            </p>
          </div>

          <div className="w-full bg-white dark:bg-[#1c2127] p-8 rounded-xl border border-[#e5e7eb] dark:border-[#3b4754] shadow-xl animate-in fade-in zoom-in-95 duration-500 delay-150">
            <form onSubmit={handleSubmit}>
              <Input
                label="Email address"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Password"
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
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e7eb] dark:border-[#3b4754]"></div>
              </div>
              <div className="relative flex justify-center text-sm uppercase">
                <span className="bg-white dark:bg-[#1c2127] px-2 text-slate-500 dark:text-[#9dabb9]">
                  Or continue with
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

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?
            <Link
              href="/signup"
              className="text-primary font-bold hover:underline ml-1"
            >
              Sign up for free
            </Link>
          </p>
        </div>
      </main>

      <BackgroundDecor />
    </div>
  );
}
