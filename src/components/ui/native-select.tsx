import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The styled native `<select>` that UserFormPage inlined. Extracted here now
 * that three screens need one. Native, not a listbox primitive: it needs no
 * portal, and `userEvent.selectOptions` drives it in jsdom without a stand-in.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
