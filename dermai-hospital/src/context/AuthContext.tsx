import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "@/api/auth";
import { setAuthToken } from "@/api/client";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const AUTH_STORAGE_KEY = "dermai_auth";

interface JwtClaims {
  sub: string;
  role: string;
  exp?: number;
}

interface StoredAuth {
  token: string;
  username: string;
}

function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function buildUser(token: string, username: string): User | null {
  const claims = decodeJwt(token);
  if (!claims?.sub || !claims.role) return null;

  if (claims.exp && claims.exp * 1000 <= Date.now()) {
    return null;
  }

  return {
    id: claims.sub,
    username,
    role: (claims.role as "admin" | "doctor") ?? "doctor",
  };
}

function readStoredAuth(): { token: string; user: User } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as StoredAuth;
    const user = buildUser(stored.token, stored.username);
    if (!user) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    setAuthToken(stored.token);
    return { token: stored.token, user };
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialAuth] = useState(() => readStoredAuth());
  const [token, setToken] = useState<string | null>(initialAuth?.token ?? null);
  const [user, setUser] = useState<User | null>(initialAuth?.user ?? null);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await loginRequest(username, password);
    const nextUser = buildUser(access_token, username);
    if (!nextUser) throw new Error("Invalid authentication token");

    setToken(access_token);
    setAuthToken(access_token);
    setUser(nextUser);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: access_token, username })
    );
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
