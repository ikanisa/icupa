import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { z } from "zod";
import { DataAccessError } from "./errors";

type QueryFactoryOptions<TSchema extends z.ZodTypeAny, TResult> = {
  queryKey: QueryKey;
  schema: TSchema;
  fetcher: () => Promise<unknown>;
  select?: (data: z.infer<TSchema>) => TResult;
  message?: string;
};

export const createValidatedQueryFactory = (queryClient: QueryClient) => {
  return async <TSchema extends z.ZodTypeAny, TResult = z.infer<TSchema>>({
    queryKey,
    schema,
    fetcher,
    select,
    message,
  }: QueryFactoryOptions<TSchema, TResult>): Promise<TResult> => {
    const data = await queryClient.fetchQuery({
      queryKey,
      queryFn: async () => {
        const raw = await fetcher();
        try {
          return schema.parse(raw);
        } catch (cause) {
          throw new DataAccessError(message ?? "Query validation failed", { cause, context: { queryKey } });
        }
      },
    });

    return select ? select(data as z.infer<TSchema>) : (data as TResult);
  };
};
