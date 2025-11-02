import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkipNavLink } from "@/components/client/SkipNavLink";

describe("keyboard navigation", () => {
  it("focuses skip navigation link on first tab", async () => {
    render(
      <div>
        <SkipNavLink />
        <a href="#secondary">Secondary</a>
        <main id="main-content">Content</main>
      </div>,
    );

    await userEvent.tab();

    const skipLink = screen.getByText(/skip to main content/i);
    expect(skipLink).toHaveFocus();
  });
});
