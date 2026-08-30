import type { paths } from "@/lib/api.types";

// The only module in the front end that indexes the generated file. If a path or
// a shape moves in the API, tsc complains here and nowhere else.
type JsonOf<T> = T extends { content: { "application/json": infer B } } ? B : never;
type Body<Op> = Op extends { requestBody?: infer R } ? JsonOf<NonNullable<R>> : never;
type Response<Op, Status extends number> = Op extends { responses: infer R }
  ? Status extends keyof R
    ? JsonOf<R[Status]>
    : never
  : never;

export type LoginBody = Body<paths["/v1/sessions/signin"]["post"]>;
export type SessionTokens = Response<paths["/v1/sessions/signin"]["post"], 200>;
export type CurrentUser = Response<paths["/v1/sessions/me"]["get"], 200>;
export type ChangePasswordBody = Body<paths["/v1/sessions/me/password"]["patch"]>;

export type Role = Response<paths["/v1/roles"]["get"], 200>[number];
export type CreateRoleBody = Body<paths["/v1/roles"]["post"]>;
export type UpdateRoleBody = Body<paths["/v1/roles/{id}"]["patch"]>;

export type Permission = Role["permissions"][number];
