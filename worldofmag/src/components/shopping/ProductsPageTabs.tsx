"use client";

import Link from "next/link";

interface ProductsPageTabsProps {
  activeTab: "products" | "units";
}

export function ProductsPageTabs({ activeTab }: ProductsPageTabsProps) {
  const tab = (id: "products" | "units", label: string) => {
    const isActive = activeTab === id;
    const href = id === "products" ? "/shopping/products" : "/shopping/products?tab=units";
    return (
      <Link
        href={href}
        className="px-4 py-2 text-sm font-medium focus:outline-none"
        style={{
          color: isActive ? "var(--text-primary)" : "var(--text-muted)",
          borderBottom: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
          marginBottom: -1,
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div
      className="flex border-b"
      style={{ borderColor: "var(--border)" }}
    >
      {tab("products", "Produkty")}
      {tab("units", "Jednostki")}
    </div>
  );
}
