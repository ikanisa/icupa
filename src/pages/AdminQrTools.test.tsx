import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("@icupa/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

describe("AdminQrTools", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    toastMock.mockReset();
  });

  it("requires both table id and admin token", async () => {
    const { default: AdminQrTools } = await import("./AdminQrTools");
    render(<AdminQrTools />);

    await userEvent.click(screen.getByRole("button", { name: /Re-issue QR/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Missing details",
      }),
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes the Supabase function and renders deterministic results", async () => {
    invokeMock.mockResolvedValue({
      data: {
        table_id: "00000000-0000-4000-8000-000000000501",
        location_id: "00000000-0000-4000-8000-000000000011",
        qr_token: "signed-token",
        signature: "signature-hash",
        qr_url: "https://example.test/qr?signed-token",
        issued_at: "2025-02-01T12:00:00.000Z",
      },
      error: null,
    });

    const { default: AdminQrTools } = await import("./AdminQrTools");
    render(<AdminQrTools />);

    await userEvent.type(screen.getByLabelText(/Table ID/i), " 00000000-0000-4000-8000-000000000501 ");
    await userEvent.type(screen.getByLabelText(/Admin token/i), " secret-token ");

    await userEvent.click(screen.getByRole("button", { name: /Re-issue QR/i }));

    expect(invokeMock).toHaveBeenCalledWith("admin/reissue_table_qr", {
      body: { table_id: "00000000-0000-4000-8000-000000000501" },
      headers: { Authorization: "Bearer secret-token" },
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "QR code rotated",
      }),
    );

    expect(screen.getByDisplayValue("https://example.test/qr?signed-token")).toBeInTheDocument();
    expect(screen.getByDisplayValue("signed-token")).toBeInTheDocument();
    expect(screen.getByDisplayValue("signature-hash")).toBeInTheDocument();

    expect(screen.getByText(/Issued/)).toHaveTextContent("Table 00000000-0000-4000-8000-000000000501");

    expect((screen.getByLabelText(/Admin token/i) as HTMLInputElement).value).toBe("");
  });

  it("surfaces failures from the Supabase function", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "Forbidden" },
    });

    const { default: AdminQrTools } = await import("./AdminQrTools");
    render(<AdminQrTools />);

    await userEvent.type(screen.getByLabelText(/Table ID/i), "00000000-0000-4000-8000-000000000501");
    await userEvent.type(screen.getByLabelText(/Admin token/i), "bad-token");

    await userEvent.click(screen.getByRole("button", { name: /Re-issue QR/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "QR rotation failed",
        variant: "destructive",
      }),
    );
  });
});
