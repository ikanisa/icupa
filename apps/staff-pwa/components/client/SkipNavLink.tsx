import { cn } from '@/lib/utils';

type SkipNavLinkProps = {
  className?: string;
};

export function SkipNavLink({ className }: SkipNavLinkProps) {
  return (
    <a
      href="#main-content"
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:z-50 focus:left-4 focus:top-4 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-primary focus:text-primary-foreground focus:shadow-lg',
        className,
      )}
    >
      Skip to main content
    </a>
  );
}
