import type { paths } from "@/lib/api.types";

/**
 * The only place in the front end that knows where these types live in the
 * generated file. If the contract moves, tsc complains here and nowhere else.
 */
type MeResponse = paths["/me"]["get"]["responses"][200]["content"]["application/json"];

export type Me = MeResponse;
export type Permission = MeResponse["permissions"][number];

export function hasPermission(permissions: readonly Permission[], required: Permission): boolean {
  return permissions.includes(required);
}
