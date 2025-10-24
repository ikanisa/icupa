import type { Metadata } from "next";
import type { ReactNode } from "react";

import { createPageMetadata } from "../../../lib/seo/metadata";

export const metadata: Metadata = createPageMetadata();

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen w-full text-white">{children}</main>;
}
