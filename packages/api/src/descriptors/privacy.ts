import { z } from "zod";

import type { DescriptorMap } from "../types";
import {
  PrivacyErasureExecuteInput,
  PrivacyErasurePlanInput,
  PrivacyExportInput,
  PrivacyRequestInput,
  PrivacyReviewInput,
  PIIScanInput,
  PIIScanResponse,
} from "@ecotrips/types";

export const privacyDescriptors = {
  "privacy.request": {
    path: "/functions/v1/privacy-request",
    method: "POST",
    auth: "user",
    input: PrivacyRequestInput,
    output: z.object({ ok: z.boolean(), request_id: z.string().optional() }),
  },
  "privacy.review": {
    path: "/functions/v1/privacy-review",
    method: "POST",
    auth: "user",
    input: PrivacyReviewInput,
    output: z.object({ ok: z.boolean(), status: z.string().optional() }),
  },
  "privacy.export": {
    path: "/functions/v1/privacy-export",
    method: "POST",
    auth: "user",
    input: PrivacyExportInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      signed_url: z.string().optional(),
    }),
  },
  "privacy.erasure.plan": {
    path: "/functions/v1/privacy-erasure-dryrun",
    method: "POST",
    auth: "user",
    input: PrivacyErasurePlanInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      signed_url: z.string().optional(),
      plan: z
        .array(
          z.object({
            table: z.string(),
            schema: z.string(),
            action: z.string(),
            count: z.number(),
          }),
        )
        .optional(),
    }),
  },
  "privacy.erasure.execute": {
    path: "/functions/v1/privacy-erasure-execute",
    method: "POST",
    auth: "user",
    input: PrivacyErasureExecuteInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      summary: z
        .array(
          z.object({
            table: z.string(),
            schema: z.string(),
            action: z.string(),
            count: z.number(),
          }),
        )
        .optional(),
    }),
  },
  "privacy.pii.scan": {
    path: "/functions/v1/privacy-pii-scan",
    method: "POST",
    auth: "user",
    input: PIIScanInput,
    output: PIIScanResponse,
  },
} satisfies DescriptorMap;
