import type { CSSProperties } from "react";

type TableStyleInit = {
  minWidth?: string;
};

type BadgePalette = {
  bg: string;
  fg: string;
};

type MonospaceInit = {
  fontSize?: string;
  opacity?: number;
};

export function createTableStyles(init: TableStyleInit = {}): {
  wrapper: CSSProperties;
  table: CSSProperties;
  headCell: CSSProperties;
  cell: CSSProperties;
} {
  const minWidth = init.minWidth ?? "640px";
  return {
    wrapper: {
      overflowX: "auto",
      borderRadius: "12px",
      border: "1px solid rgba(148, 163, 184, 0.3)",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth,
    },
    headCell: {
      textAlign: "left",
      padding: "0.5rem 0.75rem",
      fontSize: "0.75rem",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
      opacity: 0.75,
    },
    cell: {
      padding: "0.65rem 0.75rem",
      borderBottom: "1px solid rgba(71, 85, 105, 0.35)",
      verticalAlign: "top",
      fontSize: "0.95rem",
    },
  };
}

export function createBadgeStyle(palette: BadgePalette): CSSProperties {
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    background: palette.bg,
    color: palette.fg,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
}

export function monospaceTextStyle(init: MonospaceInit = {}): CSSProperties {
  const { fontSize = "0.75rem", opacity = 0.75 } = init;
  return {
    fontFamily:
      "ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize,
    opacity,
  };
}
