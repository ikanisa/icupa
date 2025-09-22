import Link from "next/link";

export default function HomePage() {
  return (
    <section>
      <h1>ecoTrips Ops Console</h1>
      <p>Select a workspace area to begin.</p>
      <nav>
        <Link href="/ops/manifests">Manifests</Link>
        <Link href="/ops/exceptions">Exceptions</Link>
        <Link href="/ops/refunds">Refunds</Link>
        <Link href="/ops/supplier-slas">Supplier SLAs</Link>
      </nav>
    </section>
  );
}
