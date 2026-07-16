"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiRequest } from "@/lib/api";

export type UserRole =
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "TEAM_MEMBER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: "ACTIVE" | "INACTIVE";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface LoginResponse {
  success: boolean;
  user: AuthUser;
}

interface CurrentUserResponse {
  success: boolean;
  user: AuthUser;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiRequest<CurrentUserResponse>(
        "/api/auth/me"
      );

      setUser(response.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  async function login(
    email: string,
    password: string
  ): Promise<void> {
    const response = await apiRequest<LoginResponse>(
      "/api/auth/login",
      {
        method: "POST",
        body: {
          email,
          password,
        },
      }
    );

    setUser(response.user);
  }

  async function logout(): Promise<void> {
    await apiRequest("/api/auth/logout", {
      method: "POST",
    });

    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider"
    );
  }

  return context;
}
