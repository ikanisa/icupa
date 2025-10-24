import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";

import { Stepper } from "../Stepper";

const sampleSteps = [
  { id: "one", label: "Collect traveller info", status: "complete" as const },
  { id: "two", label: "Confirm deposits", status: "current" as const },
  { id: "three", label: "Issue vouchers", status: "pending" as const },
];

describe("Stepper", () => {
  it("describes progress for screen readers", async () => {
    const { container } = render(<Stepper steps={sampleSteps} />);

    expect(screen.getByText(/collect traveller info/i)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
