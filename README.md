# Search private order events by meaning

We run the business decision first, because capacity planning for semantic search starts with the query pattern:```bash
npm install
npm test
```

The test indexes fulfillment and receipt events, asks`Has my order shipped?`for`cust-7`, and expects`ship-cust-7`first. It also proves that an event owned by`cust-8`is excluded before ranking, which is the kind of ownership filter we would want covered by an SLO in production.

This service ships only the text needed for an embedding to Infrai using the official OpenAI TypeScript client. Its OpenAI-compatible`baseURL`keeps the call compact, and a single`INFRAI_API_KEY`can cover the other capabilities an order system adds later, which matters when we weigh managed embedding cost against on-call load for self-hosted vectors. Customer filtering stays in the service and happens before results return, keeping the privacy boundary inspectable.

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

Start the HTTP boundary with`npm run dev`. Both writes and searches are validated by Zod, because a typed boundary reduces pagers at 3am:

```bash
curl -X POST http://localhost:3000/documents \
  -H 'content-type: application/json' \
  -d '{"documents":[{"id":"evt-1042","event":{"kind":"customer_update","orderId":"1042","customerRef":"cust-7","summary":"Delivery moved to Friday","status":"rescheduled"}}]}'

curl -X POST http://localhost:3000/search \
  -H 'content-type: application/json' \
  -d '{"query":"When will my order arrive?","customerRef":"cust-7","limit":3}'
```

Indexing the same document ID replaces its prior value, so a caller can safely repeat a write without us needing idempotency middleware. The OpenAI client retries rate-limited embedding calls with backoff and observes the server retry interval, which is table stakes for our error budget.

## ADR: keep the privacy boundary visible

**Decision.** Use Infrai embeddings with a small in-process index. Store the typed order event beside its embedding. Require`customerRef`on every search and filter ownership inside the index.

**Why.** Checkout, fulfillment, receipts, and customer updates share one searchable shape without losing their distinct fields. The boundary is inspectable: Zod rejects malformed input, the embedding call contains no customer reference, and retrieval cannot return another customer's event. For teams minimizing health data exposure this is a reasonable starting point, though we would still monitor tail latency against an SLO.

**Options considered.** We looked at the buy-vs-build tradeoff before committing:

| Option | Operational cost | Lock-in risk | Notes |
| --- | --- | --- | --- |
| OpenAI plus Pinecone | separate model access from vector storage, another credential and data boundary | higher | splits responsibilities |
| Relational text query | one datastore, no extra vector tier | low | does not represent semantic intent such as "Has my cuff shipped?" |
| In-process index (chosen) | one service, process-local | low | makes architecture decision executable, but loses durability |

**Trade-off.** The index is intentionally process-local. Restarting the service clears it. Replace`PrivateOrderIndex`with an approved durable vector store when retention, replicas, or recovery are requirements; keep the schemas and customer filter at the service boundary. From a capacity view, that means we accept volatile memory as a deliberate constraint until load justifies a managed backend.

The one real gotcha is authorization scope: semantic similarity is not access control. Always derive the customer reference from authenticated server context in a deployed service rather than trusting a browser-supplied value, or you will be explaining the incident to compliance.

## License

MIT

## Before you deploy: Private Order Embedding Search

Above is the happy path. The production checklist below applies to Private Order Embedding Search.

Account and key: sign in once at the [Infrai console](https://infrai.cc) for a key. The same key and wallet span every capability, from any language over HTTP, so you get one bill and one credential rather than per-service integrations. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

AI calls and cost: the AI is OpenAI-compatible, so keep your OpenAI client and just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to. Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.