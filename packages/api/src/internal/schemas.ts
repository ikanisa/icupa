import { z } from "zod";

export const paginatedResponse = z.object({
  ok: z.boolean(),
  data: z.array(z.record(z.any())).default([]),
  request_id: z.string().optional(),
  total: z.number().optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
});
