"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getApi } from "./data";
import type { Profile } from "./types";

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({ profile: null, loading: true, isAdmin: false, refresh: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const p = await getApi().getCurrentProfile();
      setProfile(p && p.active ? p : null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return getApi().onAuthChange(() => refresh());
  }, [refresh]);

  return (
    <AuthCtx.Provider value={{ profile, loading, isAdmin: profile?.role === "admin", refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
