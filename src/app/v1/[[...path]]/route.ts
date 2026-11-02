import { buildApp } from "@/server/app";

// One handler for the whole API: the route table decides, so a route declares its path once and the
// documentation, the tests and the server all read the same declaration.
const app = buildApp();

const handle = (request: Request) => app(request);

export { handle as DELETE, handle as GET, handle as HEAD, handle as PATCH, handle as POST, handle as PUT };
