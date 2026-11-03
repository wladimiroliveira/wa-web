import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentUser, requestSignIn, requestSignOut } from "@/features/auth/auth.api";
import type { CurrentUser, LoginBody, Permission } from "@/lib/api";
import { clearSession, getRefreshToken, onSessionCleared, setAccessToken, setRefreshToken } from "@/lib/tokens";

export const SESSION_QUERY_KEY = ["session", "me"] as const;

export type SessionStatus = "loading" | "authenticated" | "anonymous";

export interface SessionValue {
  status: SessionStatus;
  user: CurrentUser | null;
  can: (permission: Permission) => boolean;
  signIn: (body: LoginBody) => Promise<void>;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // No stored refresh token means there is nothing to rehydrate, and asking the
  // API would only produce a 401 we already know the answer to.
  //
  // This is React state, not a bare read of storage, because signing out has to
  // re-render this provider. Storage changing is invisible to React, and the query
  // cache does not help either: clearing it removes entries without notifying
  // observers that are already mounted. Without state here, an operator who signs
  // out keeps seeing their own name on a session that no longer exists.
  const [hasStoredSession, setHasStoredSession] = useState(() => getRefreshToken() !== null);

  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentUser,
    enabled: hasStoredSession,
    // A failed rehydration is an answer, not a fault worth retrying: the HTTP
    // layer already tried to rotate the token before giving up.
    retry: false,
    staleTime: Infinity,
  });

  const user = query.data ?? null;

  // A session cleared from the HTTP layer — an expired refresh token, a revoked chain —
  // has to reach React, or `RequireSession` never learns it should redirect.
  useEffect(
    () =>
      onSessionCleared(() => {
        queryClient.clear();
        setHasStoredSession(false);
      }),
    [queryClient],
  );

  const signIn = useCallback(
    async (body: LoginBody) => {
      // Whoever signed in before must not leave their data behind for whoever signs in
      // next: the same tablet changes hands between shifts.
      queryClient.clear();

      const pair = await requestSignIn(body);

      setRefreshToken(pair.refreshToken);
      setAccessToken(pair.accessToken);
      queryClient.setQueryData(SESSION_QUERY_KEY, await fetchCurrentUser());
      setHasStoredSession(true);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      if (getRefreshToken() !== null) await requestSignOut();
    } catch {
      // Leaving is a local act. A revoke the API refused must not trap the
      // operator inside a session they asked to end.
    }

    clearSession();
    // Both matter, and in this order. `clear()` drops every cached query, so no
    // screen can show the previous operator's data; `setHasStoredSession` is what
    // actually re-renders this provider, since clearing the cache notifies nobody.
    queryClient.clear();
    setHasStoredSession(false);
  }, [queryClient]);

  const value = useMemo<SessionValue>(() => {
    const status: SessionStatus =
      user !== null ? "authenticated" : !hasStoredSession || query.isError ? "anonymous" : "loading";

    return {
      status,
      user,
      can: (permission) => user?.permissions.includes(permission) ?? false,
      signIn,
      signOut,
    };
  }, [hasStoredSession, query.isError, signIn, signOut, user]);

  return <SessionContext value={value}>{children}</SessionContext>;
}
