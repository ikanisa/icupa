import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { classNames, themeTokens } from "@/styles/theme";
type PageWidth = keyof typeof themeTokens.layout;

interface PageProps {
  children: ReactNode;
  className?: string;
  variant?: "aurora" | "neutral";
  as?: ElementType;
}

export const Page = ({ children, className, variant = "aurora", as: Component = "main" }: PageProps) => {
  const variantClass = variant === "aurora" ? classNames.pageAurora : classNames.pageNeutral;
  return <Component className={cn(variantClass, className)}>{children}</Component>;
};

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  width?: PageWidth;
}

export const PageContainer = ({ children, className, width = "default" }: PageContainerProps) => {
  const widthClass = themeTokens.layout[width] ?? themeTokens.layout.default;
  return <div className={cn(widthClass, className)}>{children}</div>;
};

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export const PageHeader = ({ children, className }: PageHeaderProps) => (
  <header className={cn("flex flex-col gap-3", className)}>{children}</header>
);

export const PageTitle = ({ children, className }: PageHeaderProps) => (
  <h1 className={cn("text-3xl font-semibold tracking-tight", className)}>{children}</h1>
);

export const PageDescription = ({ children, className }: PageHeaderProps) => (
  <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
);

export const PageActions = ({ children, className }: PageHeaderProps) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
);
