import { route, type Route } from "@/server/http/route";
import { z } from "zod";
import { Permission } from "@prisma/client";
import type { Role, User } from "@prisma/client";
import {
  findUserById,
  findUserByUsername,
  revokeAllRefreshTokens,
  updatePasswordHash,
} from "@/server/modules/auth/auth.repository";
import { hashPassword } from "@/server/modules/auth/auth.password";
import { effectivePermissions } from "@/server/modules/auth/auth.permissions";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import { findRoleById } from "@/server/modules/roles/roles.repository";
import { insertUser, listUsers, updateUser } from "./users.repository";
import {
  createUserBodySchema,
  resetPasswordBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userSchema,
} from "./users.schemas";

type UserWithRole = User & { role: Role | null };

function present(user: UserWithRole) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    roleId: user.roleId,
    extraPermissions: user.extraPermissions,
    permissions: effectivePermissions({
      rolePermissions: user.role?.permissions ?? [],
      extraPermissions: user.extraPermissions,
    }),
    isActive: user.isActive,
  };
}

export const usersRoutes: Route[] = [
  route({
    method: "GET",
    path: "/users",
    auth: Permission.ACCESS_READ,
    tags: ["users"],
    summary: "Lista os usuários",
    response: { 200: z.array(userSchema) },
    handler: async (_request, reply) => reply.send((await listUsers()).map(present)),
  }),

  route({
    method: "POST",
    path: "/users",
    auth: Permission.ACCESS_CREATE,
    tags: ["users"],
    summary: "Cria um usuário",
    body: createUserBodySchema,
    response: { 201: userSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      const { password, ...rest } = request.body;

      if ((await findUserByUsername(rest.username)) !== null) {
        return reply.code(409).send({ message: "A user with this username already exists." });
      }

      if (rest.roleId != null && (await findRoleById(rest.roleId)) === null) {
        return reply.code(404).send({ message: "Role not found." });
      }

      const created = await insertUser({ ...rest, passwordHash: await hashPassword(password) });

      return reply.code(201).send(present(created));
    },
  }),

  route({
    method: "GET",
    path: "/users/:id",
    auth: Permission.ACCESS_READ,
    tags: ["users"],
    summary: "Cadastro e permissões efetivas",
    params: userIdParamsSchema,
    response: { 200: userSchema, 404: messageSchema },
    handler: async (request, reply) => {
      const user = await findUserById(request.params.id);

      if (user === null) return reply.code(404).send({ message: "User not found." });

      return reply.send(present(user));
    },
  }),

  route({
    method: "PATCH",
    path: "/users/:id",
    auth: Permission.ACCESS_UPDATE,
    tags: ["users"],
    summary: "Edita papel, permissões avulsas, nome e situação",
    params: userIdParamsSchema,
    body: updateUserBodySchema,
    response: { 200: userSchema, 404: messageSchema },
    handler: async (request, reply) => {
      const user = await findUserById(request.params.id);

      if (user === null) return reply.code(404).send({ message: "User not found." });

      if (request.body.roleId != null && (await findRoleById(request.body.roleId)) === null) {
        return reply.code(404).send({ message: "Role not found." });
      }

      const updated = await updateUser(request.params.id, request.body);

      // Deactivating has to cut the access that is already in someone's hands, not only the next
      // login. Without this, a refresh token keeps the account alive for its full lifetime.
      if (request.body.isActive === false) await revokeAllRefreshTokens(user.id);

      return reply.send(present(updated));
    },
  }),

  route({
    method: "PATCH",
    path: "/users/:id/password",
    auth: Permission.ACCESS_UPDATE,
    tags: ["users"],
    summary: "Reseta a senha de outro usuário",
    params: userIdParamsSchema,
    body: resetPasswordBodySchema,
    response: { 204: z.void(), 404: messageSchema },
    handler: async (request, reply) => {
      const user = await findUserById(request.params.id);

      if (user === null) return reply.code(404).send({ message: "User not found." });

      await updatePasswordHash(user.id, await hashPassword(request.body.newPassword));
      await revokeAllRefreshTokens(user.id);

      return reply.code(204).send();
    },
  }),
];
