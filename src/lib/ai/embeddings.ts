import { VoyageAIClient } from "voyageai";

export const voyage = process.env.VOYAGE_API_KEY
  ? new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
  : null;

export const VOYAGE_MODEL = process.env.VOYAGE_MODEL ?? "voyage-3-large";

export async function embed(texts: string[]): Promise<number[][]> {
  if (!voyage) throw new Error("Voyage not configured");
  const result = await voyage.embed({ input: texts, model: VOYAGE_MODEL });
  return (result.data ?? []).map((d) => d.embedding ?? []);
}

export function chunkText(text: string, opts: { size?: number; overlap?: number; sectionHeader?: string } = {}) {
  const size = opts.size ?? 800;
  const overlap = opts.overlap ?? 100;
  const header = opts.sectionHeader ? `${opts.sectionHeader}\n\n` : "";

  const tokens = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += size - overlap) {
    const slice = tokens.slice(i, i + size).join(" ");
    if (slice.trim().length === 0) continue;
    chunks.push(`${header}${slice}`);
  }
  return chunks;
}
