import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DataAccessError } from "./errors";

type Executor = () => Promise<{ data: unknown; error: { message: string } | null }>;

type ValidationOptions = {
  message?: string;
  context?: Record<string, unknown>;
};

export const createSupabaseDataAccess = <Database>(client: SupabaseClient<Database>) => {
  const withValidation = async <Schema extends z.ZodTypeAny>(
    executor: Executor,
    schema: Schema,
    options?: ValidationOptions,
  ): Promise<z.infer<Schema>> => {
    const { data, error } = await executor();
    if (error) {
      throw new DataAccessError(options?.message ?? error.message, { cause: error, context: options?.context });
    }

    try {
      return schema.parse(data);
    } catch (cause) {
      throw new DataAccessError(options?.message ?? "Received malformed Supabase response", {
        cause,
        context: options?.context,
      });
    }
  };

  return {
    client,
    withValidation,
  };
};

export type SupabaseDataAccess = ReturnType<typeof createSupabaseDataAccess>;
