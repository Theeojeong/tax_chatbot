"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, UserPlus, Shield, Sparkles, Clock } from "lucide-react";

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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
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
        const buttonDiv = document.getElementById("google-signup-button");
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
            width: "350",
            text: "signup_with",
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

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      // AI Studio logic was just placeholder, so we keep using our existing logic
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
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-sans text-slate-900 dark:text-white relative overflow-hidden">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 md:p-8 pt-24 md:pt-28 relative z-0">
        <div className="w-full max-w-[480px] flex flex-col items-center z-10">
          {/* Hero */}
          <div className="w-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-center mb-6">
              <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20 shadow-glow">
                <UserPlus size={40} strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight text-center pb-2">
              Create your account
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-center text-base">
              Start your journey with our Tax AI assistant today
            </p>
          </div>

          <div className="w-full bg-white dark:bg-[#1c2127] p-6 md:p-8 rounded-xl border border-gray-200 dark:border-[#3b4754] shadow-2xl animate-in fade-in zoom-in-95 duration-500 delay-150">
            <form onSubmit={handleSubmit}>
              <Input
                label="Full name"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

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
                placeholder="8 characters minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                endIcon={
                  showPassword ? <EyeOff size={20} /> : <Eye size={20} />
                }
                onEndIconClick={() => setShowPassword(!showPassword)}
              />

              <Input
                label="Confirm Password"
                type={showPasswordConfirm ? "text" : "password"}
                placeholder="Repeat password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                helperText={
                  passwordConfirm && password !== passwordConfirm
                    ? "Passwords do not match"
                    : passwordConfirm && password === passwordConfirm
                      ? "Passwords match"
                      : ""
                }
                // Add subtle color hints via helperText or separate UI if desired
                endIcon={
                  showPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />
                }
                onEndIconClick={() =>
                  setShowPasswordConfirm(!showPasswordConfirm)
                }
              />

              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-primary/25 active:scale-[0.98] hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Sign up"}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-[#3b4754]"></div>
              </div>
              <div className="relative flex justify-center text-sm uppercase">
                <span className="bg-white dark:bg-[#1c2127] px-2 text-slate-500 dark:text-[#9dabb9] font-medium text-xs tracking-wider">
                  Or sign up with
                </span>
              </div>
            </div>

            {GOOGLE_CLIENT_ID && (
              <div
                id="google-signup-button"
                className="w-full flex justify-center min-h-[44px]"
              ></div>
            )}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?
            <Link
              href="/login"
              className="text-primary font-bold hover:underline ml-1 hover:text-primary/80 transition-colors"
            >
              Log in
            </Link>
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-6 text-slate-400 dark:text-slate-600">
            <div className="flex items-center gap-1.5 transition-colors hover:text-slate-500 dark:hover:text-slate-400 cursor-default">
              <Shield size={16} />
              <span className="text-xs font-medium">Secure encryption</span>
            </div>
            <div className="flex items-center gap-1.5 transition-colors hover:text-slate-500 dark:hover:text-slate-400 cursor-default">
              <Sparkles size={16} />
              <span className="text-xs font-medium">Smart AI Models</span>
            </div>
            <div className="flex items-center gap-1.5 transition-colors hover:text-slate-500 dark:hover:text-slate-400 cursor-default">
              <Clock size={16} />
              <span className="text-xs font-medium">24/7 Availability</span>
            </div>
          </div>
        </div>
      </main>

      <BackgroundDecor />
    </div>
  );
}
