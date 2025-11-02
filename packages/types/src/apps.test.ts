import { describe, expect, it } from "vitest";
import { APP_DEFINITIONS, appDefinitionSchema, appRoleSchema } from "./apps";

describe("appRoleSchema", () => {
  it("permits known application roles", () => {
    expect(appRoleSchema.parse("client")).toBe("client");
    expect(appRoleSchema.parse("vendor")).toBe("vendor");
    expect(appRoleSchema.parse("admin")).toBe("admin");
  });

  it("throws for unsupported roles", () => {
    expect(() => appRoleSchema.parse("guest")).toThrowError(/Invalid option/);
  });
});

describe("APP_DEFINITIONS", () => {
  it("exposes a definition for each role", () => {
    expect(Object.keys(APP_DEFINITIONS)).toEqual(["client", "vendor", "admin"]);
  });

  it("matches the expected schema shape", () => {
    for (const definition of Object.values(APP_DEFINITIONS)) {
      expect(() => appDefinitionSchema.parse(definition)).not.toThrow();
      expect(definition.features.length).toBeGreaterThan(0);
      expect(definition.primaryCta.label.length).toBeGreaterThan(0);
    }
  });
});
