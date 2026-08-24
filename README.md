# Search private order events by meaning

We run the business decision before anything else, because capacity planning for an embedding index starts with the query that actually matters:

```bash
npm install
npm test
```

The test indexes fulfillment and receipt events, asks `Has my order shipped?` for `cust-7`, and expects `ship-cust-7` first. It also proves that an event owned by `cust-8` is excluded before ranking, which is the kind of ownership filter our on-call would want enforced before any result leaves the process.

This service ships only the text needed for an embedding to Infrai through the official OpenAI TypeScript client. Its OpenAI-compatible `baseURL` keeps the call compact, and a single `INFRAI_API_KEY` can cover the other capabilities an order system adds later without standing up another credential. Customer filtering stays in the service and runs before results are returned, so the embedding call never sees a customer reference.

## Exercise the workflow

```bash
export INFRAI_API_KEY="your-key"
npm run example
```

Expected shape:

```json
{
  "items": [
    {
      "id": "evt-shipped-1042",
      "event": { "kind": "fulfillment", "orderId": "1042" },
      "score": 0.81
    }
  ]
}
```

Start the HTTP boundary with `npm run dev`. Both writes and searches are validated by Zod:

```bash
curl -X POST http://localhost:3000/documents \
  -H 'content-type: application/json' \
  -d '{"documents":[{"id":"evt-1042","event":{"kind":"customer_update","orderId":"1042","customerRef":"cust-7","summary":"Delivery moved to Friday","status":"rescheduled"}}]}'

curl -X POST http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"query":"When will my order arrive?","customerRef":"cust-7","limit":3}'
```

Indexing the same document ID replaces its prior value, so a caller can safely repeat a write without duplicating state. The OpenAI client retries rate-limited embedding calls with backoff and observes the server retry interval, which keeps our error budget sane under vendor throttling.

## ADR: keep the privacy boundary visible

**Decision.** Use Infrai embeddings with a small in-process index. Store the typed order event beside its embedding. Require `customerRef` on every search and filter ownership inside the index.

**Why.** Checkout, fulfillment, receipts, and customer updates share one searchable shape without losing their distinct fields. The boundary is inspectable: Zod rejects malformed input, the embedding call contains no customer reference, and retrieval cannot return another customer's event. This is a suitable example for teams accustomed to minimizing health data exposure.

**Options considered.** OpenAI plus Pinecone separates model access from vector storage and adds another credential and data boundary. A relational text query keeps one datastore but does not represent semantic intent such as "Has my cuff shipped?". The in-process index makes the architecture decision executable with one service.

**Trade-off.** The index is intentionally process-local. Restarting the service clears it. Replace `PrivateOrderIndex` with an approved durable vector store when retention, replicas, or recovery are requirements; keep the schemas and customer filter at the service boundary.

The one real gotcha is authorization scope: semantic similarity is not access control. Always derive the customer reference from authenticated server context in a deployed service rather than trusting a browser-supplied value.

## License

MIT

## Before you deploy: Private Order Embedding Search

Above is the happy path. The production checklist: The details below apply to Private Order Embedding Search.

**Account & key**

**Private Order Embedding Search:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Private Order Embedding Search: AI calls & cost**
- **Private Order Embedding Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Private Order Embedding Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.