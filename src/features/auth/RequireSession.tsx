"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/features/auth/use-session";

/** Where the sign-in screen sends the operator back to, once they are in. */
export const SIGN_IN_RETURN_PARAM = "from";

export function RequireSession({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // The address to come back to is the one the operator was at when the session turned out to be
  // missing, read through a ref so that the redirect itself, which changes the address, does not
  // run this again and remember the sign-in screen instead.
  const returnTo = useRef(pathname);
  returnTo.current = pathname;

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?${SIGN_IN_RETURN_PARAM}=${encodeURIComponent(returnTo.current)}`);
    }
  }, [router, status]);

  // Rendering nothing while the session rehydrates is deliberate: showing the
  // sign-in screen first and then yanking it away is worse than a blank instant.
  if (status !== "authenticated") return null;

  return children;
}
