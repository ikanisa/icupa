import type { z } from "zod";

export type HttpMethod = "GET" | "POST";
export type AuthContext = "anon" | "user" | "service_role";

export interface FunctionDescriptor<
  TInput extends z.ZodTypeAny | undefined,
  TOutput extends z.ZodTypeAny | undefined,
> {
  path: string;
  method: HttpMethod;
  auth: AuthContext;
  input?: TInput;
  output?: TOutput;
  cacheTtlMs?: number;
}

export type DescriptorMap = Record<string, FunctionDescriptor<z.ZodTypeAny | undefined, z.ZodTypeAny | undefined>>;

export type InferInput<TDescriptor extends FunctionDescriptor<z.ZodTypeAny | undefined, z.ZodTypeAny | undefined>> =
  TDescriptor["input"] extends z.ZodTypeAny ? z.input<TDescriptor["input"]> : void;

export type InferOutput<TDescriptor extends FunctionDescriptor<z.ZodTypeAny | undefined, z.ZodTypeAny | undefined>> =
  TDescriptor["output"] extends z.ZodTypeAny ? z.output<TDescriptor["output"]> : never;

export type ClientOptions = {
  supabaseUrl: string;
  anonKey: string;
  getAccessToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
  defaultTimeoutMs?: number;
};

export type RequestOptions = {
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type FunctionCaller<TDescriptors extends DescriptorMap> = {
  call<K extends keyof TDescriptors>(
    key: K,
    payload: InferInput<TDescriptors[K]>,
    requestOptions?: RequestOptions,
  ): Promise<InferOutput<TDescriptors[K]>>;
};
