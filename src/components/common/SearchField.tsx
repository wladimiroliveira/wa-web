import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

/** How long typing has to pause before the search runs, so a word costs one request, not one per letter. */
export const SEARCH_DELAY_MS = 300;

interface SearchFieldProps {
  /** Names the field for assistive technology; the placeholder is not a label. */
  label: string;
  placeholder?: string;
  /** The search in effect. The field follows it when it changes from outside, as when filters are cleared. */
  value: string;
  onSearch: (value: string) => void;
}

export function SearchField({ label, placeholder, value, onSearch }: SearchFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft === value) return;

    const timer = setTimeout(() => onSearch(draft), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft, value, onSearch]);

  return (
    <div className="relative w-full sm:w-72">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}
