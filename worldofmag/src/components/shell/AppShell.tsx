"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, ShoppingCart, Calendar, FileText, Briefcase, Settings, Mail, Shield, CheckSquare, Home, Map, Image } from "lucide-react";
import { ModuleSidebar } from "./ModuleSidebar";
import { AICommandSheet } from "@/components/home/AICommandSheet";

interface AppShellProps {
  children: React.ReactNode;
  invitationCount?: number;
  isAdmin?: boolean;
}

const MODULES = [
  { id: "home",        label: "Strona główna", icon: <Home size={20} />,        topBarIcon: <Home size={16} />,        color: "var(--text-secondary)",  href: "/",            active: true,  exact: true  },
  { id: "shopping",    label: "Zakupy",        icon: <ShoppingCart size={20} />, topBarIcon: <ShoppingCart size={16} />, color: "var(--accent-blue)",     href: "/shopping",    active: true,  exact: false },
  { id: "tasks",       label: "Zadania",       icon: <CheckSquare size={20} />,  topBarIcon: <CheckSquare size={16} />,  color: "var(--accent-green)",    href: "/tasks",       active: true,  exact: false },
  { id: "notes",       label: "Notatki",       icon: <FileText size={20} />,     topBarIcon: <FileText size={16} />,     color: "var(--accent-amber)",    href: "/notes",       active: true,  exact: false },
  { id: "calendar",    label: "Calendar",      icon: <Calendar size={20} />,     topBarIcon: <Calendar size={16} />,     color: "var(--text-muted)",      href: "/calendar",    active: false, exact: false },
  { id: "work",        label: "Work",          icon: <Briefcase size={20} />,    topBarIcon: <Briefcase size={16} />,    color: "var(--text-muted)",      href: "/work",        active: false, exact: false },
  // Non-nav routes — used only for top bar label, not rendered in sidebar
  { id: "settings",    label: "Ustawienia",    icon: null,                        topBarIcon: <Settings size={16} />,    color: "var(--text-secondary)",  href: "/settings",    active: false, exact: false },
  { id: "invitations", label: "Zaproszenia",   icon: null,                        topBarIcon: <Mail size={16} />,        color: "var(--text-secondary)",  href: "/invitations", active: false, exact: false },
  { id: "admin",       label: "Admin",         icon: null,                        topBarIcon: <Shield size={16} />,      color: "var(--accent-purple)",   href: "/admin",       active: false, exact: false },
];


export function AppShell({ children, invitationCount = 0, isAdmin = false }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const activeModule = MODULES.find((m) => m.exact ? pathname === m.href : pathname.startsWith(m.href));

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

  const isShoppingActive = pathname.startsWith("/shopping");

  return (
    <div
      className="flex flex-col md:flex-row h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--bg-base)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Mobile-only top bar — paddingTop absorbs iOS status bar in PWA */}
      <div
        className="md:hidden flex-shrink-0 border-b"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center gap-2 px-3" style={{ height: 44 }}>
        <button
          onClick={() => setMenuOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded flex-shrink-0"
          style={{ color: "var(--text-secondary)", position: "relative" }}
          aria-label="Otwórz menu"
        >
          <Menu size={18} />
          {invitationCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                background: "#ef4444",
                borderRadius: "50%",
                width: 8,
                height: 8,
              }}
            />
          )}
        </button>

        <div className="flex items-center gap-1.5">
          <span style={{ color: activeModule?.color ?? "var(--accent-purple)" }}>
            {activeModule?.topBarIcon ?? <Sparkles size={16} />}
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {activeModule?.label ?? "WorldOfMag"}
          </span>
        </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="flex flex-col h-full w-64 border-r"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header — paddingTop absorbs iOS status bar in PWA standalone mode */}
            <div
              className="flex-shrink-0 border-b"
              style={{ borderColor: "var(--border)", paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex items-center justify-between px-4" style={{ height: 44 }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} style={{ color: "var(--accent-purple)" }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
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
            </div>

            {/* Module nav */}
            <nav className="flex-1 py-2 overflow-y-auto">
              {/* Home */}
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: pathname === "/" ? "var(--bg-elevated)" : undefined,
                  color: pathname === "/" ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <Home size={20} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                <span>Strona główna</span>
              </Link>

              {/* Shopping */}
              <Link
                href="/shopping"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: isShoppingActive ? "var(--bg-elevated)" : undefined,
                  color: isShoppingActive ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <ShoppingCart size={20} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
                <span>Zakupy</span>
              </Link>
              {isShoppingActive && (
                <>
                  <Link
                    href="/shopping/stores"
                    className="flex items-center gap-2 py-2 mx-2 rounded text-sm"
                    style={{ paddingLeft: 52, backgroundColor: pathname.startsWith("/shopping/stores") ? "var(--bg-elevated)" : undefined, color: pathname.startsWith("/shopping/stores") ? "var(--text-primary)" : "var(--text-muted)" }}
                  >
                    <Map size={13} />
                    Mapy sklepów
                  </Link>
                  <Link
                    href="/shopping/icons"
                    className="flex items-center gap-2 py-2 mx-2 rounded text-sm"
                    style={{ paddingLeft: 52, backgroundColor: pathname === "/shopping/icons" ? "var(--bg-elevated)" : undefined, color: pathname === "/shopping/icons" ? "var(--text-primary)" : "var(--text-muted)" }}
                  >
                    <Image size={13} />
                    Biblioteka ikon
                  </Link>
                  <Link
                    href="/shopping/icons/categories"
                    className="flex items-center gap-2 py-2 mx-2 rounded text-sm"
                    style={{ paddingLeft: 52, backgroundColor: pathname === "/shopping/icons/categories" ? "var(--bg-elevated)" : undefined, color: pathname === "/shopping/icons/categories" ? "var(--text-primary)" : "var(--text-muted)" }}
                  >
                    Przypisania ikon
                  </Link>
                </>
              )}

              {/* Tasks */}
              <Link
                href="/tasks"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: pathname.startsWith("/tasks") ? "var(--bg-elevated)" : undefined,
                  color: pathname.startsWith("/tasks") ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <CheckSquare size={20} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
                <span>Zadania</span>
              </Link>

              {/* Notes */}
              <Link
                href="/notes"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: pathname.startsWith("/notes") ? "var(--bg-elevated)" : undefined,
                  color: pathname.startsWith("/notes") ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <FileText size={20} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
                <span>Notatki</span>
              </Link>

              {/* Notes sub-items */}
              {pathname.startsWith("/notes") && (
                <div className="mb-1">
                  {[
                    { href: "/notes/all", label: "Wszystkie" },
                    { href: "/notes/groups", label: "Grupy" },
                    { href: "/notes/tags", label: "Tagi" },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center py-2 mx-2 rounded text-sm"
                      style={{
                        paddingLeft: 52,
                        backgroundColor: pathname === href ? "var(--bg-elevated)" : undefined,
                        color: pathname === href ? "var(--text-primary)" : "var(--text-muted)",
                      }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}

              {/* Inactive modules */}
              {MODULES.filter((m) => !m.active).map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center gap-3 px-4 py-3 mx-2 rounded"
                  style={{ opacity: 0.35, color: "var(--text-secondary)", cursor: "not-allowed" }}
                  title={`${mod.label} (coming soon)`}
                >
                  {mod.icon}
                  <span className="text-sm">{mod.label}</span>
                </div>
              ))}
            </nav>

            {/* Bottom: Invitations + Settings + Admin */}
            <div className="py-2 border-t" style={{ borderColor: "var(--border)", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
              <Link
                href="/invitations"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: pathname.startsWith("/invitations") ? "var(--bg-elevated)" : undefined,
                  color: pathname.startsWith("/invitations") ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <Mail size={20} />
                <span>Zaproszenia</span>
                {invitationCount > 0 && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 11,
                      borderRadius: 999,
                      padding: "1px 6px",
                    }}
                  >
                    {invitationCount}
                  </span>
                )}
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                style={{
                  backgroundColor: pathname.startsWith("/settings") ? "var(--bg-elevated)" : undefined,
                  color: pathname.startsWith("/settings") ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <Settings size={20} />
                <span>Ustawienia</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm"
                  style={{
                    backgroundColor: pathname.startsWith("/admin") ? "var(--bg-elevated)" : undefined,
                    color: pathname.startsWith("/admin") ? "var(--accent-purple)" : "var(--text-secondary)",
                  }}
                >
                  <Shield size={20} />
                  <span>Admin</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <ModuleSidebar invitationCount={invitationCount} isAdmin={isAdmin} />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>

      <AICommandSheet />
    </div>
  );
}
