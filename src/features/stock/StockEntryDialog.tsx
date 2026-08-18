import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateStockEntry } from "@/features/stock/use-stock-mutations";
import type { Supply } from "@/features/supplies/supplies.api";
import { ApiError } from "@/lib/http";
import { formatInUnit, unitLabel, unitsOfDimension } from "@/lib/unit";

const entrySchema = z.object({
  quantity: z.coerce.number().positive("Informe uma quantidade maior que zero"),
  unit: z.enum(["G", "KG", "ML", "L", "UN"]),
  note: z.string().trim().optional(),
});

type EntryForm = z.infer<typeof entrySchema>;

interface StockEntryDialogProps {
  /** The supply the entry is for; `null` keeps the dialog closed. */
  supply: Supply | null;
  onOpenChange: (open: boolean) => void;
}

function toastMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível lançar a entrada. Verifique sua conexão.";
}

export function StockEntryDialog({ supply, onOpenChange }: StockEntryDialogProps) {
  const createEntry = useCreateStockEntry();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof entrySchema>, unknown, EntryForm>({ resolver: zodResolver(entrySchema) });

  // Reopening for another supply must not carry the previous numbers, and the
  // default unit is the one that supply is bought in.
  useEffect(() => {
    if (!supply) return;
    reset({ quantity: undefined, unit: supply.purchaseUnit, note: "" });
  }, [supply, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!supply) return;

    try {
      const result = await createEntry.mutateAsync({
        supplyId: supply.id,
        quantity: values.quantity,
        unit: values.unit,
        // The API's Zod has `note` optional, not nullable: an empty field is
        // an absent field, not an empty string.
        ...(values.note ? { note: values.note } : {}),
      });
      toast.success(`Entrada lançada. Saldo agora: ${formatInUnit(result.currentStock, supply.purchaseUnit)}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(toastMessageFor(error));
    }
  });

  return (
    <Dialog open={supply !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de estoque</DialogTitle>
          <DialogDescription>{supply?.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                aria-invalid={!!errors.quantity}
                {...register("quantity")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unit">Unidade</Label>
              {/* Only the supply's dimension: the API refuses the rest, and a
                  select that offers a path which always fails is a trap. */}
              <NativeSelect id="unit" {...register("unit")}>
                {(supply ? unitsOfDimension(supply.purchaseUnit) : []).map((unit) => (
                  <option key={unit} value={unit}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {errors.quantity && (
            <p role="alert" className="text-sm text-destructive">
              {errors.quantity.message}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="note">Observação</Label>
            <Input id="note" {...register("note")} />
          </div>

          <DialogFooter>
            <DialogClose type="button">Cancelar</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              Lançar entrada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
