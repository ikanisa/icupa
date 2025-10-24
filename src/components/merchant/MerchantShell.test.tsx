import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MerchantShell } from "./MerchantShell";

type MerchantLocationResult = {
  data: Array<{
    id: string;
    tenantId: string;
    name: string;
    region: string;
    currency: string;
    timezone: string;
    taxRate: number;
  }> | undefined;
  isLoading: boolean;
};

const mockLocations: MerchantLocationResult["data"] = [
  {
    id: "loc-rw",
    tenantId: "tenant-rw",
    name: "Kigali Flagship",
    region: "RW",
    currency: "RWF",
    timezone: "Africa/Kigali",
    taxRate: 0.18,
  },
  {
    id: "loc-eu",
    tenantId: "tenant-eu",
    name: "Valletta Waterfront",
    region: "EU",
    currency: "EUR",
    timezone: "Europe/Malta",
    taxRate: 0.07,
  },
];

const merchantLocationsResult: MerchantLocationResult = {
  data: mockLocations,
  isLoading: false,
};

vi.mock("@/hooks/useMerchantLocations", () => ({
  useMerchantLocations: () => merchantLocationsResult,
}));

vi.mock("@/components/merchant/KDSBoard", () => ({
  KDSBoard: ({ location }: { location: { id: string } | null }) => (
    <div data-testid="kds-panel">{location ? `kds:${location.id}` : "kds:none"}</div>
  ),
}));

vi.mock("@/components/merchant/FloorPlanner", () => ({
  FloorPlanner: ({ location }: { location: { id: string } | null }) => (
    <div data-testid="floor-panel">{location ? `floor:${location.id}` : "floor:none"}</div>
  ),
}));

vi.mock("@/components/merchant/MenuManagerPanel", () => ({
  MenuManagerPanel: ({ location }: { location: { id: string } | null }) => (
    <div data-testid="menu-panel">{location ? `menu:${location.id}` : "menu:none"}</div>
  ),
}));

vi.mock("@/components/merchant/InventoryManagerPanel", () => ({
  InventoryManagerPanel: ({ location }: { location: { id: string } | null }) => (
    <div data-testid="inventory-panel">{location ? `inventory:${location.id}` : "inventory:none"}</div>
  ),
}));

vi.mock("@/components/merchant/PromoBuilderPanel", () => ({
  PromoBuilderPanel: ({ location }: { location: { id: string } | null }) => (
    <div data-testid="promos-panel">{location ? `promos:${location.id}` : "promos:none"}</div>
  ),
}));

vi.mock("@/components/merchant/MerchantAssistantPanel", () => ({
  MerchantAssistantPanel: ({ location }: { location: { id: string } | null }) => (
    <div data-testid="assistant-panel">{location ? `assistant:${location.id}` : "assistant:none"}</div>
  ),
}));

describe("MerchantShell", () => {
  beforeEach(() => {
    merchantLocationsResult.data = mockLocations;
    merchantLocationsResult.isLoading = false;
  });

  it("surfaces loading state while merchant locations fetch", () => {
    merchantLocationsResult.data = undefined;
    merchantLocationsResult.isLoading = true;

    render(<MerchantShell />);

    expect(screen.getByText(/Loading venues/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("defaults to the first location and switches deterministically", async () => {
    render(<MerchantShell />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Kigali Flagship");

    const select = await screen.findByRole("combobox");
    expect(select).toHaveValue("loc-rw");

    await userEvent.selectOptions(select, "loc-eu");
    expect(select).toHaveValue("loc-eu");
    expect(heading).toHaveTextContent("Valletta Waterfront");
  });

  it("renders each tenant tab with deterministic mock panels", async () => {
    render(<MerchantShell />);

    expect(screen.getByTestId("kds-panel")).toHaveTextContent("kds:loc-rw");

    await userEvent.click(screen.getByRole("tab", { name: "Promos" }));
    expect(screen.getByTestId("promos-panel")).toHaveTextContent("promos:loc-rw");

    await userEvent.click(screen.getByRole("tab", { name: "AI" }));
    expect(screen.getByTestId("assistant-panel")).toHaveTextContent("assistant:loc-rw");
  });
});
