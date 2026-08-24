import { InfraiEmbedder, PrivateOrderIndex } from "../src/order_index.js";

const index = new PrivateOrderIndex(new InfraiEmbedder());
await index.index({ documents: [
  { id: "evt-checkout-1042", event: { kind: "checkout", orderId: "1042", customerRef: "cust-7", summary: "Payment accepted for a blood pressure cuff" } },
  { id: "evt-shipped-1042", event: { kind: "fulfillment", orderId: "1042", customerRef: "cust-7", summary: "Parcel handed to carrier", carrier: "North Parcel" } },
  { id: "evt-receipt-1042", event: { kind: "receipt", orderId: "1042", customerRef: "cust-7", summary: "Receipt issued after checkout", receiptNumber: "R-1042" } }
] });

const items = await index.search({ query: "Has my cuff shipped?", customerRef: "cust-7", limit: 1 });
console.log(JSON.stringify({ items }, null, 2));
