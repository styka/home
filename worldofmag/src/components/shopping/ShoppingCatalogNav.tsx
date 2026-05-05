"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/shopping/products", label: "Produkty" },
  { href: "/shopping/units", label: "Jednostki" },
  { href: "/shopping/categories", label: "Kategorie" },
];

export function ShoppingCatalogNav() {
  const pathname = usePathname();

  return (
    <div
      className="md:hidden flex border-b flex-shrink-0"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
    >
      {TABS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="px-4 py-2.5 text-sm font-medium focus:outline-none"
            style={{
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
