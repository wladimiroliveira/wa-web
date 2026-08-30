import type { CurrentUser, Role, SessionTokens } from "@/lib/api";

// These factories are the contract test. They are typed by the generated types,
// so a mock that invents a field, or forgets one, stops compiling — which is what
// keeps the suite from passing against an API that does not exist.
export function aSessionTokens(over: Partial<SessionTokens> = {}): SessionTokens {
  return { accessToken: "access-token", refreshToken: "refresh-token", ...over };
}

export function aCurrentUser(over: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "018f0000-0000-7000-8000-000000000001",
    name: "Operador",
    username: "operador",
    roleId: null,
    permissions: ["ACCESS_READ"],
    ...over,
  };
}

export function aRole(over: Partial<Role> = {}): Role {
  return {
    id: "018f0000-0000-7000-8000-000000000010",
    name: "Gerente",
    permissions: ["ACCESS_READ", "ACCESS_CREATE"],
    ...over,
  };
}
