"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, ShoppingCart, Calendar, FileText, Briefcase, Settings } from "lucide-react";
import { ModuleSidebar } from "./ModuleSidebar";

interface AppShellProps {
  children: React.ReactNode;
}

const MODULES = [
  { id: "shopping", label: "Shopping", icon: <ShoppingCart size={20} />, topBarIcon: <ShoppingCart size={16} />, href: "/shopping", active: true },
  { id: "calendar", label: "Calendar", icon: <Calendar size={20} />, topBarIcon: <Calendar size={16} />, href: "/calendar", active: false },
  { id: "notes", label: "Notes", icon: <FileText size={20} />, topBarIcon: <FileText size={16} />, href: "/notes", active: false },
  { id: "work", label: "Work", icon: <Briefcase size={20} />, topBarIcon: <Briefcase size={16} />, href: "/work", active: false },
];

export function AppShell({ children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const activeModule = MODULES.find((m) => pathname.startsWith(m.href));

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div
      className="flex flex-col md:flex-row h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      {/* Mobile-only top bar */}
      <div
        className="md:hidden flex items-center gap-2 px-3 h-11 border-b flex-shrink-0"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setMenuOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded flex-shrink-0"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Otwórz menu"
        >
          <Menu size={18} />
        </button>

        {/* App name — subtle, left of separator */}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          WorldOfMag
        </span>

        {/* Separator */}
        <span style={{ color: "var(--border)" }}>/</span>

        {/* Active module — prominent */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--accent-purple)" }}>
            {activeModule?.topBarIcon ?? <Sparkles size={16} />}
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {activeModule?.label ?? "WorldOfMag"}
          </span>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setMenuOpen(false)}
        >
          {/* Drawer */}
          <div
            className="flex flex-col h-full w-64 border-r"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-4 h-11 border-b flex-shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: "var(--accent-purple)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  WorldOfMag
                </span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Zamknij menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Module nav */}
            <nav className="flex-1 py-2">
              {MODULES.map((mod) => {
                const isActive = pathname.startsWith(mod.href);
                if (!mod.active) {
                  return (
                    <div
                      key={mod.id}
                      className="flex items-center gap-3 px-4 py-3 mx-2 rounded"
                      style={{ opacity: 0.35, color: "var(--text-secondary)", cursor: "not-allowed" }}
                      title={`${mod.label} (coming soon)`}
                    >
                      {mod.icon}
                      <span className="text-sm">{mod.label}</span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={mod.id}
                    href={mod.href}
                    className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                    style={{
                      backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {mod.icon}
                    <span>{mod.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom settings */}
            <div className="py-2 border-t" style={{ borderColor: "var(--border)" }}>
              <div
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded"
                style={{ opacity: 0.35, color: "var(--text-secondary)", cursor: "not-allowed" }}
                title="Settings (coming soon)"
              >
                <Settings size={20} />
                <span className="text-sm">Settings</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar — hidden on mobile */}
      <ModuleSidebar />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
