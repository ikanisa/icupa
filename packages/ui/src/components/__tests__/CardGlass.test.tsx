import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";

import { CardGlass } from "../CardGlass";

describe("CardGlass", () => {
  it("provides a named section for assistive tech", async () => {
    const { container } = render(
      <CardGlass title="Lake Kivu retreat" subtitle="2 nights">
        <p>Enjoy sunset kayaking with local guides.</p>
      </CardGlass>,
    );

    const heading = screen.getByRole("heading", { name: /lake kivu retreat/i });
    expect(heading).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
