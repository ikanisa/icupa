export const MENU_SCHEMA = {
  name: "menu_schema",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["currency", "categories"],
    properties: {
      currency: { type: "string", minLength: 3, maxLength: 3 },
      categories: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "items"],
          properties: {
            name: { type: "string", minLength: 1 },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "price", "currency"],
                properties: {
                  name: { type: "string", minLength: 1 },
                  description: { type: "string" },
                  price: { type: "number", minimum: 0 },
                  currency: { type: "string", minLength: 3, maxLength: 3 },
                  allergens: { type: "array", items: { type: "string" } },
                  is_alcohol: { type: "boolean" },
                  tags: { type: "array", items: { type: "string" } },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
