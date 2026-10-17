import type { ReactNode } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsProps {
  /** Names the button for whoever cannot see the dots, and tells one row's button from the next. */
  label: string;
  children: ReactNode;
}

/** The actions of a table row behind one small button, so they do not set the height of the row. */
export function RowActions({ label, children }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={label} />}>
        <MoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-40">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const RowActionsItem = DropdownMenuItem;
