import { DataAccessError } from "./errors";
import type { ZodTypeAny, infer as ZodInfer } from "zod";

type RestClientOptions = {
  baseUrl: string;
  defaultHeaders?: () => Record<string, string>;
};

type RequestOptions = RequestInit & {
  schema?: ZodTypeAny;
  message?: string;
};

export class RestClient {
  private readonly baseUrl: string;
  private readonly headerFactory?: () => Record<string, string>;

  constructor({ baseUrl, defaultHeaders }: RestClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headerFactory = defaultHeaders;
  }

  private buildUrl(path: string) {
    if (path.startsWith("http")) {
      return path;
    }
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async request<TSchema extends ZodTypeAny>(path: string, options: RequestOptions = {}) {
    const url = this.buildUrl(path);
    const headers = new Headers(options.headers ?? {});
    const fallbackHeaders = this.headerFactory?.();
    if (fallbackHeaders) {
      Object.entries(fallbackHeaders).forEach(([key, value]) => {
        if (!headers.has(key)) {
          headers.set(key, value);
        }
      });
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const message = options.message ?? `Request to ${url} failed with status ${response.status}`;
      throw new DataAccessError(message, {
        context: {
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    const payload = await response.json();

    if (!options.schema) {
      return payload as ZodInfer<TSchema>;
    }
    try {
      return options.schema.parse(payload) as ZodInfer<TSchema>;
    } catch (cause) {
      throw new DataAccessError(options.message ?? "Response validation failed", {
        cause,
        context: { url },
      });
    }
  }
}
