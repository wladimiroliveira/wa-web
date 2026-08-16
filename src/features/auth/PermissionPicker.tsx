import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Permission } from "@/features/auth/permission";
import { originOf, type PermissionOrigin } from "@/features/auth/permission-diff";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/features/auth/permission-labels";

interface PermissionPickerProps {
  value: Permission[];
  onChange: (next: Permission[]) => void;
  /** Given, each row is annotated with where its state came from. */
  rolePermissions?: Permission[];
}

const ORIGIN_LABEL: Record<Exclude<PermissionOrigin, "none">, string> = {
  role: "do papel",
  granted: "+",
  denied: "−",
};

export function PermissionPicker({ value, onChange, rolePermissions }: PermissionPickerProps) {
  function toggle(permission: Permission, checked: boolean) {
    onChange(checked ? [...value, permission] : value.filter((current) => current !== permission));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.group} className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{group.group}</legend>

          {group.permissions.map((permission) => {
            const origin = rolePermissions ? originOf(permission, value, rolePermissions) : "none";

            return (
              <div key={permission} className="flex items-center gap-2 py-1">
                <Checkbox
                  aria-label={`${group.group} — ${PERMISSION_LABELS[permission].action}`}
                  checked={value.includes(permission)}
                  onCheckedChange={(checked) => toggle(permission, checked === true)}
                />
                <label className="text-sm" onClick={() => toggle(permission, !value.includes(permission))}>
                  {PERMISSION_LABELS[permission].action}
                </label>

                {origin !== "none" && (
                  <Badge variant="secondary" data-testid={`origin-${permission}`} className="ml-auto">
                    {ORIGIN_LABEL[origin]}
                  </Badge>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
