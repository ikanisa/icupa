import type { ReactNode } from "react";

type PublicPageProps = {
  children: ReactNode;
  align?: "start" | "center";
  gapClass?: string;
  maxWidthClass?: string;
  className?: string;
};

function combineClasses(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PublicPage({
  children,
  align = "start",
  gapClass = "gap-6",
  maxWidthClass = "max-w-3xl",
  className,
}: PublicPageProps) {
  const base = combineClasses("mx-auto flex min-h-screen flex-col px-4", gapClass, maxWidthClass);
  const alignment = align === "center" ? "items-center justify-center py-16" : "pb-24 pt-10";

  return <div className={combineClasses(base, alignment, className)}>{children}</div>;
}
