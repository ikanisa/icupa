import { describe, expect, it } from "vitest";
import {
  buildCurrencyFormatter,
  buildTimeSeries,
  computePerformanceScore,
  summariseTrend,
} from "../chartkit";

describe("chartkit", () => {
  it("builds sorted time series with formatted labels", () => {
    const result = buildTimeSeries(
      [
        { capturedAt: "2024-01-02T00:00:00Z", timeWindow: "7d", value: 120 },
        { capturedAt: "2024-01-01T00:00:00Z", timeWindow: "7d", value: 80 },
      ],
      { currency: "EUR", locale: "en-MT" },
    );

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(80);
    expect(result[1].formatted).toBe(buildCurrencyFormatter("EUR", "en-MT")(120));
  });

  it("summarises trend direction", () => {
    expect(summariseTrend([10, 12]).trend).toBe("up");
    expect(summariseTrend([12, 10]).trend).toBe("down");
    expect(summariseTrend([10, 10]).trend).toBe("flat");
  });

  it("computes weighted performance score", () => {
    const score = computePerformanceScore({ successRate: 88, toolRate: 92, avgLatencyMs: 900 });
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(100);
  });
});
