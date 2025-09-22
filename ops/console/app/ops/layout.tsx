import Link from "next/link";
import OpsProtected from "./OpsProtected";

export default function OpsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <OpsProtected>
      <div>
        <nav>
          <Link href="/ops/manifests">Manifests</Link>
          <Link href="/ops/exceptions">Exceptions</Link>
          <Link href="/ops/refunds">Refunds</Link>
          <Link href="/ops/supplier-slas">Supplier SLAs</Link>
          <Link href="/">Home</Link>
        </nav>
        {children}
      </div>
    </OpsProtected>
  );
}
