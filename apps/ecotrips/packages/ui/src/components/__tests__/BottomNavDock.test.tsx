import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";

import { BottomNavDock } from "../BottomNavDock";

const items = [
  { label: "Home", href: "/", icon: "🏠" },
  { label: "Trips", href: "/trips", icon: "🗺️" },
  { label: "Inbox", href: "/inbox", icon: "💬" },
];

describe("BottomNavDock", () => {
  it("highlights the active path while remaining accessible", async () => {
    const { container } = render(<BottomNavDock activePath="/trips" items={items} />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    const activeLink = screen.getByRole("link", { name: /trips/i });
    expect(activeLink).toHaveAttribute("href", "/trips");
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(await axe(container)).toHaveNoViolations();
  });
});
