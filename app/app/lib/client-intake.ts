import { z } from "zod";

const intentSchema = z
  .object({
    travelWindow: z
      .string()
      .max(120, "Use 120 characters or fewer for the travel window.")
      .optional(),
    partySize: z
      .number({ invalid_type_error: "Enter a numeric party size." })
      .int("Party size should be a whole number.")
      .positive("Party size must be greater than zero.")
      .optional(),
    destinations: z
      .array(z.string().min(1))
      .optional(),
    impactFocuses: z
      .array(z.string().min(1))
      .optional(),
    experienceStyles: z
      .array(z.string().min(1))
      .optional(),
    budgetMin: z
      .number({ invalid_type_error: "Enter a minimum budget." })
      .int("Budget must be a whole number.")
      .nonnegative("Budget cannot be negative.")
      .optional(),
    budgetMax: z
      .number({ invalid_type_error: "Enter a maximum budget." })
      .int("Budget must be a whole number.")
      .nonnegative("Budget cannot be negative.")
      .optional(),
  })
  .partial()
  .superRefine((intent, ctx) => {
    if (
      intent.budgetMin !== undefined &&
      intent.budgetMax !== undefined &&
      intent.budgetMax < intent.budgetMin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max budget should be greater than min budget.",
        path: ["budgetMax"],
      });
    }
  });

export const ClientCreateSchema = z.object({
  companyName: z
    .string({ required_error: "Company name is required." })
    .min(2, "Share at least 2 characters."),
  contactName: z
    .string({ required_error: "Contact name is required." })
    .min(2, "Share at least 2 characters."),
  email: z
    .string({ required_error: "Email is required." })
    .email("Enter a valid email address."),
  phone: z.string().optional(),
  intent: intentSchema.optional(),
  notes: z.string().max(2000, "Keep notes under 2000 characters.").optional(),
});

export type ClientCreate = z.infer<typeof ClientCreateSchema>;

export function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
