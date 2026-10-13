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

export type Product = Response<paths["/v1/products"]["get"], 200>[number];
export type MeasurementUnit = Product["unit"];
export type ProductKind = Product["kind"];
export type CreateProductBody = Body<paths["/v1/products"]["post"]>;

export type Supplier = Response<paths["/v1/suppliers"]["get"], 200>[number];
export type CreateSupplierBody = Body<paths["/v1/suppliers"]["post"]>;

export type CreateEntryBody = Body<paths["/v1/entries"]["post"]>;
export type Entry = Response<paths["/v1/entries"]["post"], 201>;
export type DeficitSettlement = NonNullable<CreateEntryBody["deficit"]>;

export type StockMovementPage = Response<paths["/v1/stock-movements"]["get"], 200>;
export type StockMovement = StockMovementPage["items"][number];
export type StockMovementType = StockMovement["type"];

export type LossReason = Response<paths["/v1/loss-reasons"]["get"], 200>[number];
export type CreateLossReasonBody = Body<paths["/v1/loss-reasons"]["post"]>;
export type UpdateLossReasonBody = Body<paths["/v1/loss-reasons/{id}"]["patch"]>;
export type CreateLossBody = Body<paths["/v1/losses"]["post"]>;
export type Loss = Response<paths["/v1/losses"]["post"], 201>;

export type StockPosition = Response<paths["/v1/stock"]["get"], 200>;
export type StockItem = StockPosition["items"][number];
export type StockStatus = StockItem["status"];

export type ProductStock = Response<paths["/v1/stock/{sku}"]["get"], 200>;
export type StockLot = ProductStock["lots"][number];
export type LotStatus = StockLot["status"];

export type PreWeighingPlan = Response<paths["/v1/pre-weighings/plan"]["get"], 200>;
export type CreatePreWeighingBody = Body<paths["/v1/pre-weighings"]["post"]>;
export type PreWeighing = Response<paths["/v1/pre-weighings"]["post"], 201>;
export type PreWeighingPage = Response<paths["/v1/pre-weighings"]["get"], 200>;
