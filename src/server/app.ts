import { createDispatcher, type Dispatcher } from "@/server/http/dispatch";
import { API_PREFIX } from "@/server/lib/api-version";
import { loadEnv } from "@/server/lib/env";
import { loadAuthenticatedUser } from "@/server/modules/auth/auth.repository";
import { routes } from "@/server/routes";

/** The API as one function from request to response, the same in the route handler and in the tests. */
export function buildApp(): Dispatcher {
  return createDispatcher(routes, {
    prefix: API_PREFIX,
    loadUser: loadAuthenticatedUser,
    tokenOptions: () => {
      const env = loadEnv();

      return { secret: env.JWT_SECRET, ttlMinutes: env.ACCESS_TOKEN_TTL_MINUTES };
    },
  });
}
