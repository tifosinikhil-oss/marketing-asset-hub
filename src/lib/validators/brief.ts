import { z } from "zod";

export const ContentTypeEnum = z.enum([
  "BLOG", "WHITEPAPER", "EBOOK", "CASE_STUDY", "VIDEO", "PODCAST", "WEBINAR",
  "SOCIAL_POST", "SOCIAL_CAMPAIGN", "EMAIL", "NEWSLETTER", "LANDING_PAGE",
  "WEBSITE_PAGE", "AD_CREATIVE", "INFOGRAPHIC", "PRESENTATION", "EVENT", "OTHER",
]);

export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const briefSchema = z.object({
  title: z.string().min(3, "Give it a title").max(120),
  contentType: ContentTypeEnum,
  brandId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  costCenterId: z.string().optional().nullable(),
  priority: PriorityEnum.default("MEDIUM"),
  deadline: z.coerce.date().optional().nullable(),
  channels: z.array(z.string()).default([]),
  brief: z.object({
    targetAudience: z.string().min(5, "Describe the audience"),
    keyMessages: z.array(z.string().min(1)).min(1, "Add at least one key message").max(10),
    callToAction: z.string().optional().default(""),
    brandVoice: z.string().optional().default(""),
    successMetrics: z.array(z.string()).default([]),
    notes: z.string().optional().default(""),
    references: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()).default([]),
  }),
});

export type BriefFormValues = z.infer<typeof briefSchema>;

export const briefDescribeSchema = z.object({
  description: z.string().min(20, "Tell us more — at least a sentence or two."),
  contentTypeHint: ContentTypeEnum.optional(),
});

export const CONTENT_TYPE_LABELS: Record<z.infer<typeof ContentTypeEnum>, string> = {
  BLOG: "Blog post",
  WHITEPAPER: "Whitepaper",
  EBOOK: "E-book",
  CASE_STUDY: "Case study",
  VIDEO: "Video",
  PODCAST: "Podcast episode",
  WEBINAR: "Webinar",
  SOCIAL_POST: "Social post",
  SOCIAL_CAMPAIGN: "Social campaign",
  EMAIL: "Email",
  NEWSLETTER: "Newsletter",
  LANDING_PAGE: "Landing page",
  WEBSITE_PAGE: "Website page",
  AD_CREATIVE: "Ad creative",
  INFOGRAPHIC: "Infographic",
  PRESENTATION: "Presentation",
  EVENT: "Event",
  OTHER: "Other",
};

export const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  TRIAGE: "In triage",
  ACCEPTED: "Accepted",
  RESEARCH: "Research",
  DRAFTING: "Drafting",
  REVIEW: "In review",
  DESIGN: "Design",
  WEB_DEV: "Web dev",
  QA: "QA",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
  REJECTED: "Rejected",
};

export const NEXT_STATUSES: Record<string, string[]> = {
  SUBMITTED: ["TRIAGE", "ACCEPTED", "REJECTED"],
  TRIAGE: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["RESEARCH", "DRAFTING"],
  RESEARCH: ["DRAFTING"],
  DRAFTING: ["REVIEW"],
  REVIEW: ["DRAFTING", "DESIGN"],
  DESIGN: ["WEB_DEV", "REVIEW", "QA"],
  WEB_DEV: ["QA"],
  QA: ["PUBLISHED", "DESIGN", "WEB_DEV"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
  REJECTED: [],
};
