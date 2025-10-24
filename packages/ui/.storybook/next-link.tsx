import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: ReactNode;
};

const NextLink = forwardRef<HTMLAnchorElement, LinkProps>(function NextLink(
  { children, ...props },
  ref,
) {
  return (
    <a ref={ref} {...props}>
      {children}
    </a>
  );
});

export default NextLink;
