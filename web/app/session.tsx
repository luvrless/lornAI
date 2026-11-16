/** @jsxRuntime automatic @jsxImportSource react */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { get, post, setCsrf } from "./api.ts";

export interface Me {
  user: { id: string; uid: number; username: string; email: string | null; emailVerified: boolean; displayName: string | null; createdAt: string; hasPassword: boolean; twoFactor: boolean } | null;
  connections?: { provider: string; providerUserId: string; username: string | null; avatar: string | null; linkedAt: string }[];
  staffRole?: "OWNER" | "ADMIN" | null;
  adminPanel?: boolean;
  mfaPending?: boolean;
  emailHint?: string;
}

const Ctx = createContext<{ me: Me | null; loading: boolean; serverProblem: string | null; refresh: () => Promise<Me>; logout: () => Promise<void> }>(null!);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverProblem, setServerProblem] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    let r: Me & { csrf?: string; app?: string };
    try {
      r = await get("/api/auth/me");
      // Only the LORN.LOL server marks its answers. Anything else answering here is not this platform's backend,
      // so its idea of "who is signed in" can't be trusted.
      if (!r || typeof r !== "object" || (r as any).app !== "lorn") {
        setServerProblem("This site is being served without the LORN.LOL server, so accounts, sign-in and saving can't work here.");
        r = { user: null };
      } else setServerProblem(null);
    } catch (e: any) {
      if (e?.code === "server_unreachable" || e?.code === "network") setServerProblem(e.message);
      r = { user: null };
    }
    setCsrf((r as any).csrf);
    setMe(r);
    setLoading(false);
    return r;
  }, []);
  const logout = useCallback(async () => { await post("/api/auth/logout").catch(() => {}); setMe({ user: null }); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <Ctx.Provider value={{ me, loading, serverProblem, refresh, logout }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
