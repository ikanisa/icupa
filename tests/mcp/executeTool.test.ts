import { describe, expect, it } from "vitest";
import { executeTool, loadToolManifest } from "../../mcp/runtime/executeTool";
import waiterTools from "../../mcp/waiter.tools.json";
import cfoTools from "../../mcp/cfo.tools.json";
import legalTools from "../../mcp/legal.tools.json";

describe("MCP executeTool Unit Tests", () => {
  const mockSupabaseUrl = "https://test.supabase.co";
  const mockServiceRoleKey = "test-service-role-key";

  describe("loadToolManifest", () => {
    it("should load and validate waiter tools manifest", () => {
      const manifest = loadToolManifest(waiterTools);
      expect(manifest).toBeDefined();
      expect(manifest.name).toBe("waiter_tools");
      expect(manifest.tools).toHaveLength(3);
      expect(manifest.tools[0].name).toBe("read_menu");
    });

    it("should load and validate cfo tools manifest", () => {
      const manifest = loadToolManifest(cfoTools);
      expect(manifest).toBeDefined();
      expect(manifest.name).toBe("cfo_tools");
      expect(manifest.tools.length).toBeGreaterThanOrEqual(3);
    });

    it("should load and validate legal tools manifest", () => {
      const manifest = loadToolManifest(legalTools);
      expect(manifest).toBeDefined();
      expect(manifest.name).toBe("legal_tools");
      expect(manifest.tools.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("executeTool validation", () => {
    const toolManifests = {
      waiter: loadToolManifest(waiterTools),
      cfo: loadToolManifest(cfoTools),
      legal: loadToolManifest(legalTools),
    };

    it("should reject invalid request with missing role", async () => {
      const result = await executeTool(
        {
          role: "" as any,
          toolName: "read_menu",
          params: {},
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid request");
    });

    it("should reject invalid role", async () => {
      const result = await executeTool(
        {
          role: "invalid_agent" as any,
          toolName: "read_menu",
          params: {},
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid request");
    });

    it("should reject unknown tool name", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "unknown_tool",
          params: {},
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Tool 'unknown_tool' not found");
    });

    it("should reject missing required parameters", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            // Missing required: venue_id, items, total
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Required parameter");
    });

    it("should reject invalid UUID format", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            venue_id: "not-a-uuid",
            items: [],
            total: 100,
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("must be a valid UUID");
    });

    it("should reject invalid number format", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            venue_id: "123e4567-e89b-12d3-a456-426614174000",
            items: [],
            total: "not-a-number",
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("must be a number");
    });

    it("should reject invalid date format", async () => {
      const result = await executeTool(
        {
          role: "cfo_agent",
          toolName: "post_journal",
          params: {
            entry_date: "invalid-date",
            account_dr: "1000",
            account_cr: "2000",
            amount: 100,
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("must be a valid date");
    });

    it("should reject invalid JSON for jsonb parameter", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            venue_id: "123e4567-e89b-12d3-a456-426614174000",
            items: "not-valid-json{",
            total: 100,
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("must be valid JSON");
    });

    it("should accept valid parameters for waiter create_order", async () => {
      // Note: This will fail at the Supabase execution stage since we're using mock credentials
      // but should pass validation
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            venue_id: "123e4567-e89b-12d3-a456-426614174000",
            table_id: "A1",
            items: [{ id: 1, name: "Coffee", quantity: 2, price: 5.0 }],
            total: 10.0,
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      // Should fail at execution, not validation
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain("validation");
      expect(result.error).not.toContain("Required parameter");
    });

    it("should accept valid parameters for cfo post_journal", async () => {
      const result = await executeTool(
        {
          role: "cfo_agent",
          toolName: "post_journal",
          params: {
            entry_date: "2025-01-15",
            account_dr: "1000",
            account_cr: "2000",
            amount: 1500.50,
            memo: "Test journal entry",
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      // Should fail at execution, not validation
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain("validation");
      expect(result.error).not.toContain("Required parameter");
    });

    it("should accept valid parameters for legal draft_filing", async () => {
      const result = await executeTool(
        {
          role: "legal_agent",
          toolName: "draft_filing",
          params: {
            case_id: "123e4567-e89b-12d3-a456-426614174000",
            title: "Motion to Dismiss",
            body: "This is a test filing body.",
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      // Should fail at execution, not validation
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain("validation");
      expect(result.error).not.toContain("Required parameter");
    });
  });

  describe("parameter type conversion", () => {
    const toolManifests = {
      waiter: loadToolManifest(waiterTools),
      cfo: loadToolManifest(cfoTools),
      legal: loadToolManifest(legalTools),
    };

    it("should convert string number to number type", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            venue_id: "123e4567-e89b-12d3-a456-426614174000",
            items: [],
            total: "99.99", // String that should be converted to number
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      // Should pass validation (conversion happens)
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain("must be a number");
    });

    it("should handle jsonb as object", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            venue_id: "123e4567-e89b-12d3-a456-426614174000",
            items: [{ id: 1, name: "Tea" }], // Already an object
            total: 5.0,
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      // Should pass validation
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain("must be valid JSON");
    });

    it("should handle jsonb as JSON string", async () => {
      const result = await executeTool(
        {
          role: "waiter_agent",
          toolName: "create_order",
          params: {
            venue_id: "123e4567-e89b-12d3-a456-426614174000",
            items: '[{"id": 1, "name": "Tea"}]', // JSON string
            total: 5.0,
          },
        },
        toolManifests,
        mockSupabaseUrl,
        mockServiceRoleKey
      );

      // Should pass validation
      expect(result.ok).toBe(false);
      expect(result.error).not.toContain("must be valid JSON");
    });
  });
});
