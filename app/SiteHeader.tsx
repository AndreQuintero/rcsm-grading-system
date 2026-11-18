import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <span className="brand-logo">
            <Image src="/logo.png" alt="" width={44} height={44} priority />
          </span>
          <span className="brand-text">
            <strong>Revival Cry</strong>
            <small>School of Ministry</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/teachers">Teachers</Link>
        </nav>
      </div>
    </header>
  );
}
