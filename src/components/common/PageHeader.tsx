import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </header>
  );
}
