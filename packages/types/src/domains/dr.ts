import { z } from "zod";

export const DrSnapshotInput = z.object({
  label: z.string().min(3),
  tables: z.array(z.string().min(1)).min(1).optional(),
});

export type DrSnapshotInput = z.infer<typeof DrSnapshotInput>;
