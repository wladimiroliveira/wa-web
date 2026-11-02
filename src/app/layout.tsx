import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "@/index.css";

export const metadata: Metadata = {
  title: "wa-system",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
