import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { indexRequestSchema, searchRequestSchema } from "./order_documents.js";
import { InfraiEmbedder, PrivateOrderIndex } from "./order_index.js";

const index = new PrivateOrderIndex(new InfraiEmbedder());
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/documents") {
      return json(response, 201, await index.index(indexRequestSchema.parse(await body(request))));
    }
    if (request.method === "POST" && request.url === "/search") {
      return json(response, 200, { items: await index.search(searchRequestSchema.parse(await body(request))) });
    }
    return json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError) return json(response, 400, { error: "Invalid request", issues: error.issues });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json(response, 502, { error: message });
  }
}).listen(port, () => console.log(`Order search listening on http://localhost:${port}`));

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
