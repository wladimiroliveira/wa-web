import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RowActions, RowActionsItem } from "@/components/common/RowActions";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrangeableTable } from "@/features/table-layouts/ArrangeableTable";
import { LossReasonDialog } from "@/features/losses/LossReasonDialog";
import { fetchLossReasons, lossReasonsKeys, updateLossReason } from "@/features/losses/losses.api";
import type { LossReason } from "@/lib/api";
import { messageForError } from "@/lib/form-errors";
import { PageTitle } from "@/components/layout/PageTitle";

export function LossReasonsPage() {
  const queryClient = useQueryClient();
  const reasons = useQuery({ queryKey: lossReasonsKeys.all, queryFn: fetchLossReasons });
  const [editing, setEditing] = useState<LossReason | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // A reason is never deleted: the losses recorded under it still say why. Out of use,
  // it only stops being offered.
  const toggle = useMutation({
    mutationFn: (reason: LossReason) => updateLossReason(reason.id, { isActive: !reason.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lossReasonsKeys.all }),
    onError: (error: unknown) => toast.error(messageForError(error)),
  });

  function openFor(reason: LossReason | null): void {
    setEditing(reason);
    setDialogOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageTitle>Modalidades de avaria</PageTitle>
        <Button type="button" onClick={() => openFor(null)}>
          Nova modalidade
        </Button>
      </div>

      {reasons.isPending ? <p>Carregando…</p> : null}

      {reasons.isError ? <QueryErrorState error={reasons.error} onRetry={() => void reasons.refetch()} /> : null}

      {reasons.isSuccess && reasons.data.length === 0 ? <p>Nenhuma modalidade cadastrada ainda.</p> : null}

      {reasons.isSuccess && reasons.data.length > 0 ? (
        <ArrangeableTable
          tableKey="loss-reasons"
          fill
          rows={reasons.data}
          rowKey={(reason) => reason.id}
          columns={[
            { key: "name", header: "Nome", cell: (reason) => reason.name },
            { key: "description", header: "Descrição", cell: (reason) => reason.description ?? "—" },
            {
              key: "status",
              header: "Situação",
              cell: (reason) => (
                <Badge variant={reason.isActive ? "secondary" : "outline"}>
                  {reason.isActive ? "Ativa" : "Inativa"}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "Ações",
              cell: (reason) => (
                <RowActions label={`Ações de ${reason.name}`}>
                  <RowActionsItem onClick={() => openFor(reason)}>Editar</RowActionsItem>
                  <RowActionsItem disabled={toggle.isPending} onClick={() => toggle.mutate(reason)}>
                    {reason.isActive ? "Inativar" : "Reativar"}
                  </RowActionsItem>
                </RowActions>
              ),
            },
          ]}
        />
      ) : null}

      <LossReasonDialog reason={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
