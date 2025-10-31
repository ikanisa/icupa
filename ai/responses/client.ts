import OpenAI from "openai";

// Initialize OpenAI client with API key from environment
export const responsesClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Model configuration from environment or defaults
export const RESPONSES_MODEL =
  process.env.OPENAI_RESPONSES_MODEL || "gpt-4.1-mini";
