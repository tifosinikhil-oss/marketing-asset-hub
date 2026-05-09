import Anthropic from "@anthropic-ai/sdk";

export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const BRIEF_SYSTEM_PROMPT = `You are a senior marketing producer. Given a stakeholder's free-text description of what they want to create, plus optional reference materials, fill out a structured marketing brief.

Be concrete and decisive. Where the description is vague, infer reasonable defaults from context but flag your assumptions in a "openQuestions" array. Never fabricate specific facts (numbers, names, claims) that aren't in the description or references — if a field needs facts you don't have, leave it as a question.

Return ONLY a single tool call to draft_brief. Do not chat.`;

const draftBriefTool = {
  name: "draft_brief" as const,
  description: "Produce a structured marketing brief.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Concise project title (≤80 chars)." },
      contentType: {
        type: "string",
        enum: [
          "BLOG", "WHITEPAPER", "EBOOK", "CASE_STUDY", "VIDEO", "PODCAST", "WEBINAR",
          "SOCIAL_POST", "SOCIAL_CAMPAIGN", "EMAIL", "NEWSLETTER", "LANDING_PAGE",
          "WEBSITE_PAGE", "AD_CREATIVE", "INFOGRAPHIC", "PRESENTATION", "EVENT", "OTHER",
        ],
      },
      targetAudience: { type: "string", description: "Who this is for, in 1-2 sentences." },
      keyMessages: { type: "array", items: { type: "string" }, description: "3-5 takeaways." },
      callToAction: { type: "string" },
      channels: {
        type: "array",
        items: { type: "string" },
        description: "Distribution channels (e.g. blog, LinkedIn, email).",
      },
      brandVoice: { type: "string", description: "Tone descriptors." },
      successMetrics: { type: "array", items: { type: "string" } },
      deadlineHint: { type: "string", description: "Any timing signal from the input." },
      references: { type: "array", items: { type: "string" }, description: "URLs or filenames cited." },
      openQuestions: { type: "array", items: { type: "string" } },
    },
    required: [
      "title", "contentType", "targetAudience", "keyMessages",
      "callToAction", "channels", "brandVoice", "successMetrics",
    ] as string[],
  },
};

export type DraftedBrief = {
  title: string;
  contentType: string;
  targetAudience: string;
  keyMessages: string[];
  callToAction: string;
  channels: string[];
  brandVoice: string;
  successMetrics: string[];
  deadlineHint?: string;
  references?: string[];
  openQuestions?: string[];
};

export async function draftBriefFromDescription(args: {
  description: string;
  references?: { name: string; text: string }[];
}): Promise<DraftedBrief> {
  if (!anthropic) throw new Error("Anthropic not configured");

  const referencesBlock = (args.references ?? []).map(
    (r, i) => `<reference index="${i + 1}" name="${r.name}">\n${r.text.slice(0, 12000)}\n</reference>`,
  ).join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: [
      { type: "text", text: BRIEF_SYSTEM_PROMPT },
      ...(referencesBlock
        ? [{ type: "text" as const, text: referencesBlock, cache_control: { type: "ephemeral" as const } }]
        : []),
    ],
    tools: [draftBriefTool],
    tool_choice: { type: "tool", name: "draft_brief" },
    messages: [{ role: "user", content: args.description }],
  });

  const block = response.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("No tool_use in response");
  return block.input as DraftedBrief;
}

const WBS_SYSTEM_PROMPT = `You are a senior marketing producer. Given a brief, produce a work-breakdown structure (WBS) the team will execute. Return one tool call with a tree of tasks. Be specific to the content type. Each task has: title, description (one line), defaultRole (CONTENT|DESIGN|WEBDEV|MANAGER|REVIEWER), order, optional subtasks.`;

const generateWbsTool = {
  name: "generate_wbs" as const,
  description: "Produce a work-breakdown structure for a marketing brief.",
  input_schema: {
    type: "object" as const,
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            defaultRole: { type: "string", enum: ["CONTENT", "DESIGN", "WEBDEV", "MANAGER", "REVIEWER"] },
            order: { type: "number" },
            subtasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  defaultRole: { type: "string", enum: ["CONTENT", "DESIGN", "WEBDEV", "MANAGER", "REVIEWER"] },
                  order: { type: "number" },
                },
                required: ["title", "order"] as string[],
              },
            },
          },
          required: ["title", "order"] as string[],
        },
      },
    },
    required: ["tasks"] as string[],
  },
};

export type WbsTask = {
  title: string;
  description?: string;
  defaultRole?: "CONTENT" | "DESIGN" | "WEBDEV" | "MANAGER" | "REVIEWER";
  order: number;
  subtasks?: Omit<WbsTask, "subtasks">[];
};

export async function generateWbs(brief: Record<string, unknown>): Promise<WbsTask[]> {
  if (!anthropic) throw new Error("Anthropic not configured");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: WBS_SYSTEM_PROMPT,
    tools: [generateWbsTool],
    tool_choice: { type: "tool", name: "generate_wbs" },
    messages: [
      {
        role: "user",
        content: `Brief:\n${JSON.stringify(brief, null, 2)}`,
      },
    ],
  });

  const block = response.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("No tool_use in response");
  return (block.input as { tasks: WbsTask[] }).tasks;
}
