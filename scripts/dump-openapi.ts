import { writeFileSync } from "node:fs";
import { buildOpenApiDocument } from "../src/server/http/openapi";
import { API_PREFIX } from "../src/server/lib/api-version";
import { routes } from "../src/server/routes";

// Serializing the document from the route table, rather than fetching it from a running server, is
// what lets the clients regenerate their types with nothing but a checkout: no port, no database.
const document = buildOpenApiDocument(routes, API_PREFIX);

writeFileSync(new URL("../openapi.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);

console.log("openapi.json written");
