import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";

import { Toast } from "../Toast";

describe("Toast", () => {
  it("exposes an accessible live region", async () => {
    const { container } = render(
      <Toast
        id="payment-success"
        title="Payment received"
        description="We sent a confirmation email."
        intent="success"
        durationMs={120000}
      />,
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(await axe(container)).toHaveNoViolations();
  });
});
