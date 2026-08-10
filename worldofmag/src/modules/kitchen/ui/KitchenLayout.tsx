"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, CalendarDays, Package, BookOpen, ChefHat } from "lucide-react";

interface KitchenLayoutProps {
  children: React.ReactNode;
}

const TABS = [
  { href: "/kitchen/recipes", label: "Przepisy", icon: BookMarked },
  { href: "/kitchen/plan", label: "Plan", icon: CalendarDays },
  { href: "/kitchen/pantry", label: "Spiżarnia", icon: Package },
  { href: "/kitchen/cookbooks", label: "Książki", icon: BookOpen },
];

export function KitchenLayout({ children }: KitchenLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header
        className="flex-shrink-0 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="hidden md:flex items-center gap-2 px-6 py-3">
          <ChefHat size={20} style={{ color: "var(--accent-orange)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Kuchnia
          </h1>
        </div>
        <nav className="flex items-center gap-1 px-3 md:px-6 py-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? "var(--bg-elevated)" : "transparent",
                  color: isActive ? "var(--accent-orange)" : "var(--text-secondary)",
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
