import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SnapshotForm } from "./SnapshotForm";

const adminActionFormMock = vi.fn();

vi.mock("@ecotrips/ui", () => ({
  AdminActionForm: (props: unknown) => {
    adminActionFormMock(props);
    return <div data-testid="admin-action-form" />;
  },
}));

describe("SnapshotForm", () => {
  it("forwards snapshot configuration to AdminActionForm", async () => {
    const action = vi.fn().mockResolvedValue({ status: "success" });

    render(<SnapshotForm action={action} />);

    expect(adminActionFormMock).toHaveBeenCalledTimes(1);
    const props = adminActionFormMock.mock.calls[0][0] as Record<string, unknown>;

    expect(props.initialState).toEqual({ status: "idle" });
    expect(props.submitLabel).toBe("Create snapshot");
    expect(props.pendingLabel).toBe("Creating…");
    expect(props.toastId).toBe("dr-snapshot");
    expect(props.successTitle).toBe("Snapshot complete");
    expect(props.errorTitle).toBe("Snapshot failed");
    expect(props.offlineTitle).toBe("Authentication required");
    expect(props.defaultDescription).toContain("withObs logs");

    const fields = props.fields as Array<Record<string, unknown>>;
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ name: "label", required: true });
    expect(typeof props.action).toBe("function");

    await (props.action as (state: unknown, formData: FormData) => Promise<unknown>)({ status: "idle" }, new FormData());
    expect(action).toHaveBeenCalled();
  });
});
