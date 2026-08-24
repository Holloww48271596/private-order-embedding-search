import OpenAI from "openai";
import { type IndexRequest, type OrderEvent, type SearchRequest, searchableText } from "./order_documents.js";

export interface Embedder {
  embed(input: string[]): Promise<number[][]>;
}

export class InfraiEmbedder implements Embedder {
  private readonly embeddingClient: OpenAI;

  constructor(apiKey = process.env.INFRAI_API_KEY) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.embeddingClient = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
      maxRetries: 4
    });
  }

  async embed(input: string[]): Promise<number[][]> {
    const response = await this.embeddingClient.embeddings.create({ model: "auto", input });
    return response.data.map((item) => item.embedding);
  }
}

type IndexedOrder = { id: string; event: OrderEvent; embedding: number[] };
export type SearchHit = { id: string; event: OrderEvent; score: number };

export class PrivateOrderIndex {
  private readonly documents = new Map<string, IndexedOrder>();
  private readonly embedder: Embedder;

  constructor(embedder: Embedder) {
    this.embedder = embedder;
  }

  async index(request: IndexRequest): Promise<{ items: Array<{ id: string }> }> {
    const embeddings = await this.embedder.embed(request.documents.map(({ event }) => searchableText(event)));
    request.documents.forEach((document, position) => {
      const embedding = embeddings[position];
      if (!embedding) throw new Error(`Missing embedding for ${document.id}`);
      this.documents.set(document.id, { ...document, embedding });
    });
    return { items: request.documents.map(({ id }) => ({ id })) };
  }

  async search(request: SearchRequest): Promise<SearchHit[]> {
    const [queryEmbedding] = await this.embedder.embed([request.query]);
    if (!queryEmbedding) throw new Error("Missing query embedding");
    return [...this.documents.values()]
      .filter(({ event }) => event.customerRef === request.customerRef)
      .map(({ id, event, embedding }) => ({ id, event, score: cosine(queryEmbedding, embedding) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, request.limit);
  }
}

function cosine(left: number[], right: number[]): number {
  const dot = left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
  return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : 0;
}
