import { z } from "zod";
import { route, type Route } from "@/server/http/route";
import { AUTHENTICATED, PUBLIC } from "./auth.access";
import { hashPassword, verifyPassword } from "./auth.password";
import { findUserById, revokeAllRefreshTokens, updatePasswordHash } from "./auth.repository";
import { login, logout, refreshSession } from "./auth.service";
import {
  changeOwnPasswordBodySchema,
  currentUserSchema,
  loginBodySchema,
  messageSchema,
  refreshBodySchema,
  sessionTokensSchema,
} from "./auth.schemas";

const INVALID_CREDENTIALS = { message: "Invalid credentials." };

export const authRoutes: Route[] = [
  route({
    method: "POST",
    path: "/sessions/signin",
    auth: PUBLIC,
    rateLimit: {
      max: 5,
      timeWindowMs: 60_000,
      // The key includes the username: limiting by IP alone lets one office share the budget, and
      // by username alone lets one IP sweep every account.
      keyGenerator: (request) => `${request.ip}:${(request.body as { username?: string } | undefined)?.username ?? ""}`,
    },
    tags: ["auth"],
    summary: "Autentica e devolve o par de tokens",
    body: loginBodySchema,
    response: { 200: sessionTokensSchema, 401: messageSchema },
    handler: async (request, reply) => {
      const tokens = await login(request.body);

      // The same answer for an unknown username and for a wrong password: telling them apart would
      // turn the login route into a directory of who exists.
      if (tokens === null) return reply.code(401).send(INVALID_CREDENTIALS);

      return reply.send(tokens);
    },
  }),

  route({
    method: "POST",
    path: "/sessions/refresh",
    auth: PUBLIC,
    tags: ["auth"],
    summary: "Rotaciona o par de tokens",
    body: refreshBodySchema,
    response: { 200: sessionTokensSchema, 401: messageSchema },
    handler: async (request, reply) => {
      const tokens = await refreshSession(request.body.refreshToken);

      if (tokens === null) return reply.code(401).send(INVALID_CREDENTIALS);

      return reply.send(tokens);
    },
  }),

  route({
    method: "POST",
    path: "/sessions/signout",
    auth: AUTHENTICATED,
    tags: ["auth"],
    summary: "Encerra a sessão, revogando o refresh token",
    body: refreshBodySchema,
    response: { 204: z.void() },
    handler: async (request, reply) => {
      await logout(request.body.refreshToken);

      return reply.code(204).send();
    },
  }),

  route({
    method: "GET",
    path: "/sessions/me",
    auth: AUTHENTICATED,
    tags: ["auth"],
    summary: "Usuário atual e suas permissões efetivas",
    response: { 200: currentUserSchema },
    handler: async (request, reply) => {
      const current = request.currentUser!;
      const user = await findUserById(current.id);

      return reply.send({
        id: current.id,
        name: user!.name,
        username: user!.username,
        roleId: user!.roleId,
        permissions: current.permissions,
      });
    },
  }),

  route({
    method: "PATCH",
    path: "/sessions/me/password",
    auth: AUTHENTICATED,
    tags: ["auth"],
    summary: "Troca a própria senha",
    body: changeOwnPasswordBodySchema,
    response: { 204: z.void(), 401: messageSchema },
    handler: async (request, reply) => {
      const user = await findUserById(request.currentUser!.id);
      const matches = await verifyPassword(request.body.currentPassword, user!.passwordHash);

      if (!matches) return reply.code(401).send(INVALID_CREDENTIALS);

      await updatePasswordHash(user!.id, await hashPassword(request.body.newPassword));

      // Every session goes, this one included. A refresh token stolen before the change would
      // otherwise outlive it, and the change would have solved nothing.
      await revokeAllRefreshTokens(user!.id);

      return reply.code(204).send();
    },
  }),
];
