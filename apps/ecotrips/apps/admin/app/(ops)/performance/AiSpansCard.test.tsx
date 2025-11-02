import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AiSpansCard } from "./AiSpansCard";

vi.mock("@ecotrips/ui", () => ({
  CardGlass: ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
    <section>
      <header>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div>{children}</div>
    </section>
  ),
}));

const spans = [
  {
    id: "span-fast-ok",
    toolKey: "ocr.match-menu",
    agent: "ops-audit",
    requestId: "req-fast-ok",
    startedAt: Date.parse("2024-05-01T12:00:00Z"),
    durationMs: 1200,
    status: 200,
    ok: true,
    hashes: { request: "abc123456789", response: "def987654321" },
    tokenCounts: { request: 120, response: 80 },
  },
  {
    id: "span-slow-ok",
    toolKey: "ai.waiter",
    agent: "diner",
    requestId: "req-slow-ok",
    startedAt: Date.parse("2024-05-01T12:05:00Z"),
    durationMs: 3600,
    status: 200,
    ok: true,
    hashes: { request: "ghi123456789", response: "jkl987654321" },
    tokenCounts: { request: 300, response: 250 },
  },
  {
    id: "span-error",
    toolKey: "payments.charge",
    agent: "admin",
    requestId: "req-error",
    startedAt: Date.parse("2024-05-01T12:10:00Z"),
    durationMs: 2400,
    status: 500,
    ok: false,
    hashes: { request: "mno123456789", error: "pqr987654321" },
    tokenCounts: { request: 180, error: 10 },
  },
] as const;

describe("AiSpansCard", () => {
  it("orders spans by duration by default", () => {
    render(<AiSpansCard spans={spans} />);

    const rows = screen.getAllByRole("row").slice(1); // skip header
    const firstRow = within(rows[0]);
    expect(firstRow.getByText("ai.waiter")).toBeVisible();
    expect(firstRow.getByText("Success")).toBeVisible();
    expect(firstRow.getByText("3,600")).toBeVisible();
  });

  it("prioritises failing spans when toggled to error sort", async () => {
    render(<AiSpansCard spans={spans} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Errors/i }));

    const rows = screen.getAllByRole("row").slice(1);
    const firstRow = within(rows[0]);
    expect(firstRow.getByText("payments.charge")).toBeVisible();
    expect(firstRow.getByText("Error")).toBeVisible();
    expect(firstRow.getByText(/err 10/i)).toBeVisible();

    // Duration button should still restore the slowest span ordering
    await user.click(screen.getByRole("button", { name: /Duration/i }));
    const resortedRows = screen.getAllByRole("row").slice(1);
    expect(within(resortedRows[0]).getByText("ai.waiter")).toBeVisible();
  });
});
