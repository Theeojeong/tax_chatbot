import type { TokenResponse, User } from "./types";

export function setAuth(payload: TokenResponse) {
  localStorage.setItem("token", payload.access_token);
  localStorage.setItem("user", JSON.stringify(payload.user));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem("user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch (err) {
    return null;
  }
}
