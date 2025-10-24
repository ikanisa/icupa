import { z } from "zod";

const ISO_DATE_REGEX = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const EmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Email must be valid.");

const emptyToUndefined = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return value;
};

const OptionalHumanNameSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .min(1, "Name cannot be empty.")
    .max(200, "Name is too long.")
    .optional(),
);

const OptionalPhoneSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .min(1, "Phone number cannot be empty.")
    .max(64, "Phone number must be 64 characters or fewer.")
    .optional(),
);

const NotesSchema = z
  .string()
  .trim()
  .max(5000, "Notes must be 5,000 characters or fewer.")
  .optional();

const SafeIntegerLikeSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^-?\d+$/, "Value must be a whole number.")
      .transform((value) => Number(value)),
    z.number({ invalid_type_error: "Value must be a number." }),
  ])
  .refine(Number.isFinite, { message: "Value must be finite." })
  .refine(Number.isSafeInteger, { message: "Value must be a safe integer." });

const OptionalSafeIntegerSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }
    return value;
  },
  SafeIntegerLikeSchema.optional(),
);

const PartySizeSchema = OptionalSafeIntegerSchema.refine(
  (value) => value === undefined || value > 0,
  {
    message: "Party size must be a positive whole number.",
  },
);

const BudgetSchema = OptionalSafeIntegerSchema.refine(
  (value) => value === undefined || value >= 0,
  {
    message: "Budget must be zero or a positive number of cents.",
  },
);

const IsoDateSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(ISO_DATE_REGEX, "Date must use YYYY-MM-DD format.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Date must be a valid calendar day.",
    })
    .optional(),
);

const DestinationSchema = z
  .string()
  .trim()
  .min(1, "Destinations cannot contain empty entries.")
  .max(120, "Destination names must be shorter than 120 characters.");

export const IntentSchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .min(1, "Company name is required."),
    contact_name: OptionalHumanNameSchema,
    email: EmailSchema,
    phone: OptionalPhoneSchema,
    party_size: PartySizeSchema,
    start_date: IsoDateSchema,
    end_date: IsoDateSchema,
    destinations: z
      .array(DestinationSchema)
      .optional()
      .default([]),
    budget_min_cents: BudgetSchema,
    budget_max_cents: BudgetSchema,
    notes: NotesSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.budget_min_cents !== undefined &&
      value.budget_max_cents !== undefined &&
      value.budget_min_cents > value.budget_max_cents
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum budget cannot exceed the maximum budget.",
        path: ["budget_min_cents"],
      });
    }

    if (value.start_date && value.end_date) {
      const start = new Date(value.start_date).getTime();
      const end = new Date(value.end_date).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be on or after the start date.",
          path: ["end_date"],
        });
      }
    }
  });

export const B2B_API_KEY_SCOPES = [
  "inventory.read",
  "leads.write",
] as const;

export const ApiKeyStatusSchema = z.enum(["active", "suspended", "revoked"]);

const ScopeValueSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9._-]+$/, "Scopes may only include lowercase letters, numbers, dots, underscores, or hyphens.");

export const ClientCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Client name is required."),
    description: z
      .string()
      .trim()
      .max(1000, "Description must be 1,000 characters or fewer.")
      .optional(),
    key_prefix: z
      .string()
      .trim()
      .min(8, "Key prefix must be at least 8 characters.")
      .max(64, "Key prefix must be 64 characters or fewer.")
      .regex(/^[A-Za-z0-9_-]+$/, "Key prefix may only contain letters, numbers, underscores, or hyphens."),
    key_hash: z
      .string()
      .trim()
      .length(64, "Key hash must be a 64-character hex string.")
      .regex(/^[A-Fa-f0-9]{64}$/u, "Key hash must be a hex-encoded SHA-256 digest."),
    status: ApiKeyStatusSchema.default("active"),
    scopes: z
      .array(z.union([z.enum(B2B_API_KEY_SCOPES), ScopeValueSchema]))
      .min(1, "Select at least one scope."),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .default({}),
    created_by: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    const unique = new Set(value.scopes.map((scope) => scope.trim()));
    if (unique.size !== value.scopes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scopes cannot include duplicates.",
        path: ["scopes"],
      });
    }
  });

export type IntentPayload = z.infer<typeof IntentSchema>;
export type IntentInput = z.input<typeof IntentSchema>;
export type ClientCreatePayload = z.infer<typeof ClientCreateSchema>;
export type ClientCreateInput = z.input<typeof ClientCreateSchema>;
