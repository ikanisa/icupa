import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { buildWarnings, estimateDistanceMeters } from "./index.ts";
import {
  buildMapRouteHealthPayload,
  SAFETY_WARNING_CHECKS,
} from "./health.ts";
import {
  calculateSafetyWarningCoverage,
  SAFETY_WARNING_TYPES,
} from "./safety.ts";

denoTestDistance();
denoTestHealthChecks();
denoTestCoverageSummary();
denoTestHealthPayload();

function denoTestDistance() {
  Deno.test("estimateDistanceMeters is deterministic and >= 5km seed", () => {
    const origin = "Sample Origin";
    const destination = "Sample Destination";
    const first = estimateDistanceMeters(origin, destination);
    const second = estimateDistanceMeters(origin, destination);
    assertEquals(first, second);
    assert(first >= 20_000);
  });
}

function denoTestHealthChecks() {
  Deno.test("health checks model expected warnings", () => {
    for (const check of SAFETY_WARNING_CHECKS) {
      const start = new Date(check.request.departure_time);
      const end = new Date(check.request.arrival_time);
      const warnings = buildWarnings(start, end).sort();
      const expected = [...check.expectedWarnings].sort();
      assertEquals(
        warnings,
        expected,
        `Check ${check.id} (${check.description}) did not match warnings`,
      );
    }
  });
}

function denoTestCoverageSummary() {
  Deno.test("safety warning checks cover every known warning", () => {
    const covered = new Set<string>();
    for (const check of SAFETY_WARNING_CHECKS) {
      for (const warning of check.expectedWarnings) {
        covered.add(warning);
      }
    }

    for (const warning of SAFETY_WARNING_TYPES) {
      assert(
        covered.has(warning),
        `Expected health coverage to include warning ${warning}`,
      );
    }
  });

  Deno.test("calculateSafetyWarningCoverage flags triggered warnings", () => {
    const sampleWarnings = ["night_travel"];
    const coverage = calculateSafetyWarningCoverage(sampleWarnings);
    const coverageMap = Object.fromEntries(
      coverage.map((item) => [item.warning, item.triggered]),
    );
    for (const warning of SAFETY_WARNING_TYPES) {
      const expected = sampleWarnings.includes(warning);
      assertEquals(
        coverageMap[warning] ?? false,
        expected,
        `Coverage mismatch for warning ${warning}`,
      );
    }
  });
}

function denoTestHealthPayload() {
  Deno.test("map-route health payload exposes safety coverage", () => {
    const frozen = new Date("2024-06-01T00:00:00.000Z");
    const payload = buildMapRouteHealthPayload({ now: frozen });
    assertEquals(payload.ok, true);
    assertEquals(payload.fn, "map-route");
    assertEquals(payload.time, frozen.toISOString());
    assertEquals(payload.knownWarnings, [...SAFETY_WARNING_TYPES]);
    assertEquals(payload.safetyWarningChecks, SAFETY_WARNING_CHECKS);
  });
}
