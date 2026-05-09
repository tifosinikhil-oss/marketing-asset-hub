"use server";

import { auth } from "@/auth";
import { draftBriefFromDescription, type DraftedBrief } from "@/lib/ai/anthropic";

export async function aiDraftBrief(formData: FormData): Promise<
  { draft: DraftedBrief } | { error: string }
> {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const description = (formData.get("description") as string)?.trim();
  if (!description || description.length < 20) {
    return { error: "Tell us a bit more — at least a sentence or two." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "AI is not configured. Add ANTHROPIC_API_KEY in .env." };
  }

  try {
    const draft = await draftBriefFromDescription({ description });
    return { draft };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
