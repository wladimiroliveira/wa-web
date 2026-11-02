"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/features/auth/session-context";
import { createQueryClient } from "@/lib/query";

export function Providers({ children }: { children: ReactNode }) {
  // Built inside the component, so the server does not share one cache between every request.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
