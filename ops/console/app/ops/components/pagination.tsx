import Link from "next/link";
import type { CSSProperties } from "react";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  buildPageHref: (page: number) => string;
};

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page) || page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

export function Pagination({ page, pageSize, total, buildPageHref }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = clampPage(page, totalPages);

  const controlsStyle: CSSProperties = {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginTop: "1.5rem",
  };

  const buttonStyle: CSSProperties = {
    padding: "0.45rem 0.9rem",
    borderRadius: "9999px",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    background: "rgba(15, 23, 42, 0.35)",
    color: "inherit",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
  };

  const disabledStyle: CSSProperties = {
    opacity: 0.45,
    pointerEvents: "none",
  };

  const summaryStyle: CSSProperties = {
    fontSize: "0.85rem",
    opacity: 0.75,
  };

  const prevPage = safePage - 1;
  const nextPage = safePage + 1;
  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  return (
    <nav aria-label="Pagination" style={controlsStyle}>
      <span style={summaryStyle}>
        Page {safePage} of {totalPages} · Showing {(safePage - 1) * pageSize + 1}–
        {Math.min(safePage * pageSize, total)} of {total} records
      </span>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Link
          href={buildPageHref(prevPage)}
          aria-disabled={!hasPrev}
          style={{ ...buttonStyle, ...(hasPrev ? null : disabledStyle) }}
        >
          ← Previous
        </Link>
        <Link
          href={buildPageHref(nextPage)}
          aria-disabled={!hasNext}
          style={{ ...buttonStyle, ...(hasNext ? null : disabledStyle) }}
        >
          Next →
        </Link>
      </div>
    </nav>
  );
}

export default Pagination;
