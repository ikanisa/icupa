import { z } from "zod";
import { baseToolInput } from "./tool.common";

export const WebsearchInput = baseToolInput.extend({
  query: z
    .string()
    .min(3, "Query must be at least 3 characters")
    .max(256, "Query must be less than 256 characters"),
  topK: z.number().int().min(1).max(5).default(3),
  locale: z.string().optional(),
});

export type WebsearchInputType = z.infer<typeof WebsearchInput>;
