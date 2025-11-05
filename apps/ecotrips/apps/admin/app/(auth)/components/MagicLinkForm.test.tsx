import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MagicLinkForm } from "./MagicLinkForm";

const createClientComponentClientMock = vi.fn();

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createClientComponentClient: (...args: unknown[]) => createClientComponentClientMock(...args),
}));

vi.mock("@ecotrips/ui", () => ({
  Button: ({ children, ...props }: Record<string, unknown>) => (
    <button {...props}>{children}</button>
  ),
  Toast: ({ title, description, onDismiss, id }: Record<string, unknown>) => (
    <div role="status" data-testid={`toast-${id}`}>
      <p>{title as string}</p>
      {description ? <p>{description as string}</p> : null}
      <button type="button" onClick={onDismiss as () => void}>
        Dismiss
      </button>
    </div>
  ),
}));

describe("MagicLinkForm", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    createClientComponentClientMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prompts for configuration when Supabase credentials are missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";

    render(<MagicLinkForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Ops email/i), "ops@icupa.test");
    await user.click(screen.getByRole("button", { name: /Send magic link/i }));

    expect(await screen.findByText(/Configuration needed/i)).toBeVisible();
    expect(createClientComponentClientMock).not.toHaveBeenCalled();
  });

  it("sends a magic link and surfaces success feedback", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    createClientComponentClientMock.mockReturnValue({ auth: { signInWithOtp } });

    render(<MagicLinkForm redirectPath="/flags" />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Ops email/i), "ops@icupa.test");
    await user.click(screen.getByRole("button", { name: /Send magic link/i }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ops@icupa.test",
      options: {
        emailRedirectTo: expect.stringContaining("/api/auth/callback?next=%2Fflags"),
      },
    });
    expect(await screen.findByText(/Magic link sent/i)).toBeVisible();
    expect(screen.getByLabelText(/Ops email/i)).toHaveValue("");
  });

  it("shows toast feedback when Supabase returns an error", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const signInWithOtp = vi.fn().mockResolvedValue({ error: { message: "Throttled" } });
    createClientComponentClientMock.mockReturnValue({ auth: { signInWithOtp } });

    render(<MagicLinkForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Ops email/i), "ops@icupa.test");
    await user.click(screen.getByRole("button", { name: /Send magic link/i }));

    expect(await screen.findByText(/Sign-in failed/i)).toBeVisible();
    expect(screen.getByText(/Throttled/i)).toBeVisible();
  });
});
