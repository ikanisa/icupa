import { z } from "zod";

export const customerSupportResolutionSchema = z.object({
  ticketId: z.string(),
  summary: z.string(),
  resolutionSteps: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      status: z.enum(["pending", "completed", "blocked"]),
    })
  ),
  customerImpact: z.enum(["low", "medium", "high"]).default("low"),
  escalationRequired: z.boolean().default(false),
});

export const researchBriefSchema = z.object({
  topic: z.string(),
  keyFindings: z.array(z.string()),
  references: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
    })
  ),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const complianceChecklistSchema = z.object({
  jurisdiction: z.string(),
  controls: z.array(
    z.object({
      controlId: z.string(),
      description: z.string(),
      status: z.enum(["pass", "fail", "not_applicable"]),
      evidence: z.string().optional(),
    })
  ),
  reviewer: z.string(),
});

export type CustomerSupportResolution = z.infer<typeof customerSupportResolutionSchema>;
export type ResearchBrief = z.infer<typeof researchBriefSchema>;
export type ComplianceChecklist = z.infer<typeof complianceChecklistSchema>;

export const outputSchemas = {
  "customer-support": customerSupportResolutionSchema,
  research: researchBriefSchema,
  compliance: complianceChecklistSchema,
};

export function validateDomainOutput<T extends keyof typeof outputSchemas>(
  domain: T,
  data: unknown
): z.infer<(typeof outputSchemas)[T]> {
  return outputSchemas[domain].parse(data);
}
