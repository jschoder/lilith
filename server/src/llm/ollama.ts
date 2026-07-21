import { z } from "zod";
import type { LlmPort } from "./port.js";

export interface OllamaConfig {
  baseUrl: string;
  chatModel: string;
  embedModel: string;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

interface OllamaEmbeddingsResponse {
  embedding?: number[];
}

/** Real LLM/embedding adapter, backed by a local Ollama server. */
export class OllamaLlmPort implements LlmPort {
  constructor(private readonly config: OllamaConfig) {}

  async generateStructured<T>(args: { system: string; prompt: string; schema: z.ZodType<T> }): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.config.chatModel,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.prompt },
        ],
        format: z.toJSONSchema(args.schema),
        stream: false,
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama chat request failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as OllamaChatResponse;
    if (!body.message?.content) {
      throw new Error("Ollama chat response had no message content");
    }
    return args.schema.parse(JSON.parse(body.message.content));
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.config.embedModel, prompt: text }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embeddings request failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as OllamaEmbeddingsResponse;
    if (!body.embedding) {
      throw new Error("Ollama embeddings response had no embedding");
    }
    return body.embedding;
  }
}
