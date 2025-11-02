import type { MouseEventHandler, FocusEventHandler, TouchEventHandler } from "react";
import { forwardRef, useMemo } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useIntentPrefetch, type PrefetchQuery } from "@/hooks/useIntentPrefetch";
import { prefetchRoute } from "@/modules/routing/AppRouter";

interface PrefetchNavLinkProps extends LinkProps {
  prefetchQueries?: PrefetchQuery[];
}

export const PrefetchNavLink = forwardRef<HTMLAnchorElement, PrefetchNavLinkProps>(
  ({ to, onMouseEnter, onFocus, onTouchStart, prefetchQueries, ...props }, ref) => {
    const routePrefetcher = useMemo(() => {
      if (typeof to === "string") {
        return () => prefetchRoute(to);
      }
      return undefined;
    }, [to]);

    const { trigger } = useIntentPrefetch({ route: routePrefetcher, queries: prefetchQueries });

    const handleMouseEnter: MouseEventHandler<HTMLAnchorElement> = (event) => {
      onMouseEnter?.(event);
      if (!event.defaultPrevented) {
        trigger();
      }
    };

    const handleFocus: FocusEventHandler<HTMLAnchorElement> = (event) => {
      onFocus?.(event);
      if (!event.defaultPrevented) {
        trigger();
      }
    };

    const handleTouchStart: TouchEventHandler<HTMLAnchorElement> = (event) => {
      onTouchStart?.(event);
      if (!event.defaultPrevented) {
        trigger();
      }
    };

    return (
      <Link
        ref={ref}
        to={to}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        onTouchStart={handleTouchStart}
        {...props}
      />
    );
  },
);

PrefetchNavLink.displayName = "PrefetchNavLink";
