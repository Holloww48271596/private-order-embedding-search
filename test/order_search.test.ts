import assert from "node:assert/strict";
import test from "node:test";
import { PrivateOrderIndex, type Embedder } from "../src/order_index.js";

class DeterministicEmbedder implements Embedder {
  async embed(input: string[]): Promise<number[][]> {
    return input.map((text) => text.includes("shipped") || text.includes("carrier") ? [1, 0] : [0, 1]);
  }
}

test("shipment intent returns the fulfillment event without crossing customers", async () => {
  const index = new PrivateOrderIndex(new DeterministicEmbedder());
  await index.index({ documents: [
    { id: "ship-cust-7", event: { kind: "fulfillment", orderId: "1042", customerRef: "cust-7", summary: "Parcel handed to carrier", carrier: "North Parcel" } },
    { id: "receipt-cust-7", event: { kind: "receipt", orderId: "1042", customerRef: "cust-7", summary: "Receipt issued", receiptNumber: "R-1042" } },
    { id: "ship-cust-8", event: { kind: "fulfillment", orderId: "1043", customerRef: "cust-8", summary: "Parcel handed to carrier", carrier: "South Parcel" } }
  ] });

  const hits = await index.search({ query: "Has my order shipped?", customerRef: "cust-7", limit: 2 });
  assert.equal(hits[0]?.id, "ship-cust-7");
  assert.equal(hits.some(({ id }) => id === "ship-cust-8"), false);
});
