import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, it, expect, vi } from "vitest";

import { IconButton } from "../IconButton";

describe("IconButton", () => {
  it("exposes an accessible label and toggles", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <IconButton aria-label="Toggle favourite" onClick={onClick}>
        ❤️
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: /toggle favourite/i });
    expect(await axe(container)).toHaveNoViolations();

    await user.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});
