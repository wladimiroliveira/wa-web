import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchTableLayouts,
  resetTableLayout,
  saveTableLayout,
  tableLayoutsKeys,
} from "@/features/table-layouts/table-layouts.api";
import type { TableLayout, TableLayoutBody } from "@/lib/api";

/**
 * The layout the user gave one table, and the ways to change it. A change shows at once and is
 * written behind it; if the write fails, the table goes back to what the server holds.
 */
export function useTableLayout(tableKey: string) {
  const queryClient = useQueryClient();
  // Only this user changes their layouts, and another device's change shows on the next session.
  const layouts = useQuery({ queryKey: tableLayoutsKeys.all, queryFn: fetchTableLayouts, staleTime: Infinity });
  const saved = layouts.data?.find((layout) => layout.tableKey === tableKey);

  const rewrite = (change: (others: TableLayout[]) => TableLayout[]) =>
    queryClient.setQueryData<TableLayout[]>(tableLayoutsKeys.all, (current = []) =>
      change(current.filter((layout) => layout.tableKey !== tableKey)),
    );
  const onError = () => {
    toast.error("Não foi possível salvar a disposição das colunas.");
    void queryClient.invalidateQueries({ queryKey: tableLayoutsKeys.all });
  };
  // One table's writes go out one at a time, in the order they were made, so the last one stays.
  const scope = { id: `table-layout:${tableKey}` };

  const saving = useMutation({
    scope,
    mutationFn: (body: TableLayoutBody) => saveTableLayout(tableKey, body),
    onError,
  });
  const resetting = useMutation({ scope, mutationFn: () => resetTableLayout(tableKey), onError });

  // The cache changes here rather than in `onMutate`, which runs a tick later: a column let go
  // after a drag would otherwise jump back for a frame.
  function save(body: TableLayoutBody): void {
    rewrite((others) => [...others, { tableKey, ...body }]);
    saving.mutate(body);
  }

  function reset(): void {
    rewrite((others) => others);
    resetting.mutate();
  }

  return { saved, save, reset };
}
