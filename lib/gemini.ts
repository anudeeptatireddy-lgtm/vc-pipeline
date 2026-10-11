// The single place that calls Gemini (CLAUDE.md rule 1). Gemini 3 deprecates
// temperature/top_p/top_k, so none are sent. Every response is zod-validated.
import { GoogleGenAI, type Tool } from "@google/genai";
import { z } from "zod";

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client = new GoogleGenAI({ apiKey });
  return client;
}

export const model = () => process.env.GEMINI_MODEL || "gemini-3.7-flash";

export const geminiUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };

export interface GeminiJsonOptions {
  /** Google Search grounding. */
  search?: boolean;
  /** Let the model read URLs mentioned in the prompt. */
  urlContext?: boolean;
}

export interface GeminiJsonResult<T> {
  data: T;
  /** URLs the model actually retrieved (url_context) or cited (grounding). */
  retrievedUrls: string[];
}

/** Structured JSON call. Throws if the response doesn't match `schema`. */
export async function geminiJson<S extends z.ZodType>(
  prompt: string,
  schema: S,
  opts: GeminiJsonOptions = {},
): Promise<GeminiJsonResult<z.infer<S>>> {
  const tools: Tool[] = [];
  if (opts.search) tools.push({ googleSearch: {} });
  if (opts.urlContext) tools.push({ urlContext: {} });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ai().models.generateContent({
        model: model(),
        contents: prompt,
        config: {
          tools: tools.length ? tools : undefined,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
        },
      });
      geminiUsage.calls++;
      geminiUsage.inputTokens += res.usageMetadata?.promptTokenCount ?? 0;
      geminiUsage.outputTokens += res.usageMetadata?.candidatesTokenCount ?? 0;

      const text = res.text ?? "";
      const data = schema.parse(JSON.parse(text)) as z.infer<S>;
      const cand = res.candidates?.[0];
      const retrievedUrls = [
        ...(cand?.urlContextMetadata?.urlMetadata ?? [])
          .filter((m) => String(m.urlRetrievalStatus ?? "").includes("SUCCESS"))
          .map((m) => m.retrievedUrl ?? ""),
        ...(cand?.groundingMetadata?.groundingChunks ?? []).map((c) => c.web?.uri ?? ""),
      ].filter(Boolean);
      return { data, retrievedUrls };
    } catch (e) {
      lastError = e;
      const msg = String((e as Error).message ?? e);
      // Retry once on transient errors and malformed JSON; fail fast otherwise.
      if (!/429|500|503|UNAVAILABLE|RESOURCE_EXHAUSTED|JSON|ZodError|invalid_/i.test(msg)) break;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error(`gemini: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
