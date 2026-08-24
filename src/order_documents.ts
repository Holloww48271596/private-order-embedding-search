import { z } from "zod";

export type OrderEvent =
  | { kind: "checkout"; orderId: string; customerRef: string; summary: string }
  | { kind: "fulfillment"; orderId: string; customerRef: string; summary: string; carrier: string }
  | { kind: "receipt"; orderId: string; customerRef: string; summary: string; receiptNumber: string }
  | { kind: "customer_update"; orderId: string; customerRef: string; summary: string; status: string };

export type IndexRequest = { documents: Array<{ id: string; event: OrderEvent }> };
export type SearchRequest = { query: string; customerRef: string; limit: number };

export const orderEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("checkout"), orderId: z.string().min(1), customerRef: z.string().min(1), summary: z.string().min(1) }),
  z.object({ kind: z.literal("fulfillment"), orderId: z.string().min(1), customerRef: z.string().min(1), summary: z.string().min(1), carrier: z.string().min(1) }),
  z.object({ kind: z.literal("receipt"), orderId: z.string().min(1), customerRef: z.string().min(1), summary: z.string().min(1), receiptNumber: z.string().min(1) }),
  z.object({ kind: z.literal("customer_update"), orderId: z.string().min(1), customerRef: z.string().min(1), summary: z.string().min(1), status: z.string().min(1) })
]) as unknown as z.ZodType<OrderEvent>;

export const indexRequestSchema = z.object({
  documents: z.array(z.object({ id: z.string().min(1), event: orderEventSchema })).min(1)
}) as unknown as z.ZodType<IndexRequest>;

export const searchRequestSchema = z.object({
  query: z.string().min(1),
  customerRef: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(5)
}) as unknown as z.ZodType<
  SearchRequest,
  z.ZodTypeDef,
  { query: string; customerRef: string; limit?: number }
>;

export function searchableText(event: OrderEvent): string {
  const detail = event.kind === "fulfillment" ? event.carrier
    : event.kind === "receipt" ? event.receiptNumber
    : event.kind === "customer_update" ? event.status
    : "confirmed";
  return `${event.kind} order ${event.orderId}: ${event.summary}. ${detail}`;
}
