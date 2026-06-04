"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stethoscope, Pill } from "lucide-react";

const TABS = [
  { href: "/health", label: "Wizyty i badania", icon: Stethoscope, exact: true },
  { href: "/health/leki", label: "Leki i pielęgnacja", icon: Pill, exact: false },
];

export function HealthNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex-shrink-0 border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <nav className="flex items-center gap-1 px-3 md:px-6 py-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? "var(--bg-elevated)" : "transparent",
                  color: isActive ? "var(--accent-red)" : "var(--text-secondary)",
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
