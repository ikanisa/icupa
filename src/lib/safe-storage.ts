import type { StateStorage } from "zustand/middleware";
import { emitClientEvent } from "@/lib/client-events";

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  return String(error ?? "unknown error");
}

export function createSafeStateStorage(
  storage: Storage,
  options: { storageName?: "localStorage" | "sessionStorage" } = {}
): StateStorage {
  const storageName = options.storageName ?? "localStorage";

  return {
    getItem: (key) => {
      try {
        return storage.getItem(key);
      } catch (error) {
        emitClientEvent({
          type: "storage_error",
          payload: {
            storage: storageName,
            operation: "get",
            key,
            message: normalizeErrorMessage(error),
            quotaExceeded: error instanceof DOMException && error.name === "QuotaExceededError",
          },
        });
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        storage.setItem(key, value);
      } catch (error) {
        emitClientEvent({
          type: "storage_error",
          payload: {
            storage: storageName,
            operation: "set",
            key,
            message: normalizeErrorMessage(error),
            quotaExceeded: error instanceof DOMException && error.name === "QuotaExceededError",
          },
        });
      }
    },
    removeItem: (key) => {
      try {
        storage.removeItem(key);
      } catch (error) {
        emitClientEvent({
          type: "storage_error",
          payload: {
            storage: storageName,
            operation: "remove",
            key,
            message: normalizeErrorMessage(error),
            quotaExceeded: error instanceof DOMException && error.name === "QuotaExceededError",
          },
        });
      }
    },
  } satisfies StateStorage;
}
