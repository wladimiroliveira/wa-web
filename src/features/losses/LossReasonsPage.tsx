import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LossReasonDialog } from "@/features/losses/LossReasonDialog";
import { fetchLossReasons, lossReasonsKeys, updateLossReason } from "@/features/losses/losses.api";
import type { LossReason } from "@/lib/api";
import { messageForError } from "@/lib/form-errors";

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Modalidades de avaria</h1>
        <Button type="button" onClick={() => openFor(null)}>
          Nova modalidade
        </Button>
      </div>

      {reasons.isPending ? <p>Carregando…</p> : null}

      {reasons.isError ? <QueryErrorState error={reasons.error} onRetry={() => void reasons.refetch()} /> : null}

      {reasons.isSuccess && reasons.data.length === 0 ? <p>Nenhuma modalidade cadastrada ainda.</p> : null}

      {reasons.isSuccess && reasons.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reasons.data.map((reason) => (
              <TableRow key={reason.id}>
                <TableCell>{reason.name}</TableCell>
                <TableCell>{reason.description ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={reason.isActive ? "secondary" : "outline"}>
                    {reason.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => openFor(reason)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(reason)}
                    >
                      {reason.isActive ? "Inativar" : "Reativar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <LossReasonDialog reason={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
