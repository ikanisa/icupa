import { describe, expect, it } from "vitest";
import type { AppRole } from "@icupa/types/apps";
import { coreFeatureFlags, createFeatureFlag, featureFlagSchema } from "./feature-flags";

describe("feature flag schema", () => {
  it("creates flags with explicit metadata", () => {
    const flag = createFeatureFlag({
      key: "ai-beta",
      description: "Expose AI waiter opt-in to selected tenants.",
      enabledByDefault: true,
      audience: ["client", "admin"],
    });

    expect(flag).toEqual({
      key: "ai-beta",
      description: "Expose AI waiter opt-in to selected tenants.",
      enabledByDefault: true,
      audience: ["client", "admin"],
    });
  });

  it("applies defaults for optional properties", () => {
    const flag = featureFlagSchema.parse({
      key: "experimental",
      description: "Toggle experimental feature",
    });

    expect(flag.enabledByDefault).toBe(false);
    expect(flag.audience).toEqual([]);
  });

  it("rejects unsupported audiences", () => {
    expect(() =>
      createFeatureFlag({
        key: "bad-audience",
        description: "Invalid audience entry",
        audience: ["unsupported" as unknown as AppRole],
      }),
    ).toThrowError(/Invalid option/);
  });
});

describe("coreFeatureFlags", () => {
  it("includes the expected default toggles", () => {
    expect(Object.keys(coreFeatureFlags)).toEqual(["multiPwaBanner", "aiWaiterBeta"]);
    expect(coreFeatureFlags.multiPwaBanner.key).toBe("multi-pwa-banner");
    expect(coreFeatureFlags.aiWaiterBeta.audience).toContain("client");
  });
});
