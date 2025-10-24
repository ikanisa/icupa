let initialized = false;

export async function initAxe() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;

  try {
    const [{ default: axe }, React, ReactDOM] = await Promise.all([
      import("@axe-core/react"),
      import("react"),
      import("react-dom"),
    ]);

    axe(React, ReactDOM, 1000);
    initialized = true;
  } catch (error) {
    console.warn("Failed to start accessibility audits", error);
  }
}
