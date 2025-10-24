import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";

import { Button } from "../Button";

describe("Button", () => {
  it("renders an accessible native button", async () => {
    const { container } = render(<Button>Book now</Button>);
    expect(screen.getByRole("button", { name: /book now/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("supports slotting via asChild without accessibility regressions", async () => {
    const { container } = render(
      <Button asChild>
        <a href="/trips">View trips</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: /view trips/i });
    expect(link).toHaveAttribute("href", "/trips");
    expect(await axe(container)).toHaveNoViolations();
  });
});
