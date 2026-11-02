import { route, type Route } from "@/server/http/route";
import { z } from "zod";
import { Permission } from "@prisma/client";
import { messageSchema } from "@/server/modules/auth/auth.schemas";
import { deleteRole, findRoleById, findRoleByName, insertRole, listRoles, updateRole } from "./roles.repository";
import { createRoleBodySchema, roleIdParamsSchema, roleSchema, updateRoleBodySchema } from "./roles.schemas";

export const rolesRoutes: Route[] = [
  route({
    method: "GET",
    path: "/roles",
    auth: Permission.ACCESS_READ,
    tags: ["roles"],
    summary: "Lista os papéis",
    response: { 200: z.array(roleSchema) },
    handler: async (_request, reply) => reply.send(await listRoles()),
  }),

  route({
    method: "POST",
    path: "/roles",
    auth: Permission.ACCESS_CREATE,
    tags: ["roles"],
    summary: "Cria um papel",
    body: createRoleBodySchema,
    response: { 201: roleSchema, 409: messageSchema },
    handler: async (request, reply) => {
      if ((await findRoleByName(request.body.name)) !== null) {
        return reply.code(409).send({ message: "A role with this name already exists." });
      }

      return reply.code(201).send(await insertRole(request.body));
    },
  }),

  route({
    method: "PATCH",
    path: "/roles/:id",
    auth: Permission.ACCESS_UPDATE,
    tags: ["roles"],
    summary: "Edita o nome e o pacote de permissões",
    params: roleIdParamsSchema,
    body: updateRoleBodySchema,
    response: { 200: roleSchema, 404: messageSchema, 409: messageSchema },
    handler: async (request, reply) => {
      if ((await findRoleById(request.params.id)) === null) {
        return reply.code(404).send({ message: "Role not found." });
      }

      if (request.body.name !== undefined) {
        const sameName = await findRoleByName(request.body.name);

        if (sameName !== null && sameName.id !== request.params.id) {
          return reply.code(409).send({ message: "A role with this name already exists." });
        }
      }

      return reply.send(await updateRole(request.params.id, request.body));
    },
  }),

  route({
    method: "DELETE",
    path: "/roles/:id",
    auth: Permission.ACCESS_UPDATE,
    tags: ["roles"],
    summary: "Remove o papel; seus usuários ficam sem herança",
    params: roleIdParamsSchema,
    response: { 204: z.void(), 404: messageSchema },
    handler: async (request, reply) => {
      if ((await findRoleById(request.params.id)) === null) {
        return reply.code(404).send({ message: "Role not found." });
      }

      await deleteRole(request.params.id);

      return reply.code(204).send();
    },
  }),
];
