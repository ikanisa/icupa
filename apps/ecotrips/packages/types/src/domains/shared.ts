import { z } from "zod";

export const LocaleEnum = z.enum(["en", "rw"]);
export type Locale = z.infer<typeof LocaleEnum>;

export const CurrencyCode = z
  .string()
  .length(3, "currency_code_length")
  .transform((value) => value.toUpperCase());
export type CurrencyCode = z.infer<typeof CurrencyCode>;
