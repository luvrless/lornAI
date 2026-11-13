/** @jsxRuntime automatic @jsxImportSource react */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { get, post, setCsrf } from "./api.ts";

export interface Me {
  user: { id: string; uid: number; username: string; email: string | null; emailVerified: boolean; displayName: string | null; createdAt: string; hasPassword: boolean; twoFactor: boolean } | null;
  connections?: { provider: string; providerUserId: string; username: string | null; avatar: string | null; linkedAt: string }[];
  staffRole?: "OWNER" | "ADMIN" | null;
  adminPanel?: boolean;
  mfaPending?: boolean;
}

const Ctx = createContext<{ me: Me | null; loading: boolean; refresh: () => Promise<Me>; logout: () => Promise<void> }>(null!);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const r = await get<Me & { csrf?: string }>("/api/auth/me").catch(() => ({ user: null }) as Me);
    setCsrf((r as any).csrf);
    setMe(r);
    setLoading(false);
    return r;
  }, []);
  const logout = useCallback(async () => { await post("/api/auth/logout").catch(() => {}); setMe({ user: null }); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
