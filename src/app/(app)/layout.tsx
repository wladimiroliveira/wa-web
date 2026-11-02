"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RequireSession } from "@/features/auth/RequireSession";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <AppShell>{children}</AppShell>
    </RequireSession>
  );
}
