import { createContext, useContext, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, ApiError } from "../lib/api";

interface Me {
  username: string;
}

interface AuthContextValue {
  username: string | null;
  /** True while the initial /auth/me check (on page load) is in flight. */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginError: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [loginError, setLoginError] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<Me>("/auth/me"),
    retry: false,
    // A 401 here just means "not logged in" — not an error state the UI
    // should keep retrying or treat as a fetch failure.
    throwOnError: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      apiPost<Me>("/auth/login", { username, password }),
    onSuccess: (me) => {
      setLoginError(null);
      queryClient.setQueryData(["auth", "me"], me);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiPost("/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
    },
  });

  async function login(username: string, password: string) {
    setLoginError(null);
    try {
      await loginMutation.mutateAsync({ username, password });
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Login failed");
      throw err;
    }
  }

  async function logout() {
    await logoutMutation.mutateAsync();
  }

  const value: AuthContextValue = {
    username: meQuery.data?.username ?? null,
    loading: meQuery.isLoading,
    login,
    loginError,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
