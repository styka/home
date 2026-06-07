"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Calendar, Briefcase, Settings, Mail, Shield, Map, Image, Lock, MoreHorizontal, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AppName } from "@/components/brand/AppName";
import { ModuleSidebar } from "./ModuleSidebar";
import { DataFreshness } from "./DataFreshness";
import { AICommandSheet } from "@/components/home/AICommandSheet";
import { FeedbackInspector } from "./FeedbackInspector";
import { ToastProvider } from "@/components/ui/Toast";
import { isPathLocked } from "@/lib/permissions";
import { MODULES, resolveMenu, resolveTabBar, defaultMenuPrefs, type MenuPrefs } from "@/lib/modules";
import { updateMenuPrefs } from "@/actions/menuPrefs";

interface AppShellProps {
  children: React.ReactNode;
  invitationCount?: number;
  isAdmin?: boolean;
  userRoles?: string[];
  userPermissions?: string[];
  menuPrefs?: MenuPrefs;
}

// Pozycje dolne (stałe, niepodlegające konfiguracji) — do wykrywania aktywnego modułu i paska górnego.
type BottomItem = { id: string; label: string; href: string; Icon: LucideIcon; color: string; exact?: boolean };
const BOTTOM_ITEMS: BottomItem[] = [
  { id: "settings",    label: "Ustawienia",  href: "/settings",    Icon: Settings, color: "var(--text-secondary)" },
  { id: "invitations", label: "Zaproszenia", href: "/invitations", Icon: Mail,     color: "var(--text-secondary)" },
  { id: "admin",       label: "Admin",       href: "/admin",       Icon: Shield,   color: "var(--accent-purple)" },
];

export function AppShell({ children, invitationCount = 0, isAdmin = false, userRoles = [], userPermissions = [], menuPrefs = defaultMenuPrefs() }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  const { enabled, more } = resolveMenu(userPermissions, menuPrefs);

  // Aktywny moduł (do paska górnego) — szukamy wśród wszystkich pozycji, nawet wyłączonych.
  const activeModule =
    [...MODULES].find((m) => (m.exact ? pathname === m.href : pathname.startsWith(m.href))) ??
    BOTTOM_ITEMS.find((m) => pathname.startsWith(m.href));

  function isLocked(href: string): boolean {
    return isPathLocked(userPermissions, href);
  }

  function enableModule(id: string) {
    const nextDisabled = menuPrefs.disabled.filter((d) => d !== id);
    startTransition(async () => {
      await updateMenuPrefs({ disabled: nextDisabled });
      router.refresh();
    });
  }

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Dolny pasek (mobile): osobno konfigurowalny zestaw/kolejność ikon (niezależny od menu).
  const tabBar = resolveTabBar(userPermissions, menuPrefs);

  return (
    <ToastProvider>
    <DataFreshness />
    <div
      className="flex flex-col md:flex-row h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--bg-base)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Mobile top bar */}
      <div
        className="md:hidden flex-shrink-0 border-b"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", paddingTop: "env(safe-area-inset-top)" }}
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
              <span style={{ position: "absolute", top: 2, right: 2, background: "#ef4444", borderRadius: "50%", width: 8, height: 8 }} />
            )}
          </button>
          <Link
            href={activeModule?.href ?? "/"}
            className="flex items-center gap-1.5"
            style={{ textDecoration: "none" }}
            title={`Przejdź do: ${activeModule?.label ?? "Strona główna"}`}
          >
            <span style={{ color: activeModule?.color ?? "var(--accent-purple)" }}>
              {activeModule ? <activeModule.Icon size={16} /> : <BrandLogo px={18} />}
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {activeModule?.label ?? <AppName />}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          data-omnia-overlay="nav"
          className="md:hidden fixed inset-0 z-50 flex"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="flex flex-col h-full w-64 border-r"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 border-b" style={{ borderColor: "var(--border)", paddingTop: "env(safe-area-inset-top)" }}>
              <div className="flex items-center justify-between px-4" style={{ height: 44 }}>
                <div className="flex items-center gap-2">
                  <BrandLogo px={20} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}><AppName /></span>
                </div>
                <button onClick={() => setMenuOpen(false)} className="flex items-center justify-center w-8 h-8 rounded" style={{ color: "var(--text-secondary)" }} aria-label="Zamknij menu">
                  <X size={16} />
                </button>
              </div>
            </div>

            <nav className="flex-1 py-2 overflow-y-auto">
              {/* Moduły dostępne i włączone (w kolejności użytkownika) */}
              {enabled.map((m) => (
                <div key={m.id}>
                  <MobileItem href={m.href} exact={m.exact} pathname={pathname}>
                    <m.Icon size={20} style={{ color: m.color, flexShrink: 0 }} /><span>{m.label}</span>
                  </MobileItem>
                  {(m.exact ? pathname === m.href : pathname.startsWith(m.href)) && (
                    <MobileModuleSubNav id={m.id} pathname={pathname} />
                  )}
                </div>
              ))}

              {/* „Więcej…" — działy dostępne, ale wyłączone przez użytkownika */}
              {more.length > 0 && (
                <>
                  <button
                    onClick={() => setMoreOpen((v) => !v)}
                    className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm w-[calc(100%-1rem)] focus:outline-none"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <MoreHorizontal size={20} /><span>Więcej…</span>
                  </button>
                  {moreOpen && more.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => enableModule(m.id)}
                      className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm w-[calc(100%-1rem)] focus:outline-none"
                      style={{ color: "var(--text-secondary)" }}
                      title={`Włącz „${m.label}" w menu`}
                    >
                      <m.Icon size={20} style={{ color: m.color, flexShrink: 0 }} /><span>{m.label}</span>
                      <Plus size={14} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />
                    </button>
                  ))}
                </>
              )}

              {/* Coming soon (nie zależą od uprawnień) */}
              {[{ label: "Work", icon: <Briefcase size={20} />, href: "/work" }].map((mod) => (
                <div key={mod.href} className="flex items-center gap-3 px-4 py-3 mx-2 rounded" style={{ opacity: 0.35, color: "var(--text-secondary)", cursor: "not-allowed" }} title={`${mod.label} (coming soon)`}>
                  {mod.icon}<span className="text-sm">{mod.label}</span>
                </div>
              ))}
            </nav>

            <div className="py-2 border-t" style={{ borderColor: "var(--border)", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
              <MobileItem href="/invitations" pathname={pathname} locked={isLocked("/invitations")}>
                <Mail size={20} /><span>Zaproszenia</span>
                {invitationCount > 0 && (
                  <span style={{ marginLeft: "auto", background: "#ef4444", color: "var(--on-accent)", fontSize: 11, borderRadius: 999, padding: "1px 6px" }}>{invitationCount}</span>
                )}
              </MobileItem>
              <MobileItem href="/settings" pathname={pathname} locked={isLocked("/settings")}>
                <Settings size={20} /><span>Ustawienia</span>
              </MobileItem>
              {isAdmin && (
                <MobileItem href="/admin" pathname={pathname}>
                  <Shield size={20} /><span>Admin</span>
                </MobileItem>
              )}
            </div>
          </div>
        </div>
      )}

      <ModuleSidebar invitationCount={invitationCount} isAdmin={isAdmin} userRoles={userRoles} userPermissions={userPermissions} menuPrefs={menuPrefs} />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0 pb-14 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      {tabBar.length > 0 && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border)",
            paddingBottom: "env(safe-area-inset-bottom)",
            height: "calc(56px + env(safe-area-inset-bottom))",
          }}
        >
          {tabBar.map((m) => {
            const isActive = m.exact ? pathname === m.href : pathname.startsWith(m.href);
            return (
              <Link
                key={m.id}
                href={m.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs"
                style={{ color: isActive ? m.color : "var(--text-muted)" }}
              >
                <m.Icon size={20} />
                <span style={{ fontSize: 10 }}>{m.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <AICommandSheet />
      {isAdmin && <FeedbackInspector />}
    </div>
    </ToastProvider>
  );
}

/** Mobilna sub-nawigacja modułu (tylko tam, gdzie miała sens w drawerze). */
function MobileModuleSubNav({ id, pathname }: { id: string; pathname: string }) {
  if (id === "shopping") {
    return (
      <>
        <MobileSub href="/shopping/stores" pathname={pathname}><Map size={13} />Mapy sklepów</MobileSub>
        <MobileSub href="/shopping/icons" pathname={pathname}><Image size={13} />Biblioteka ikon</MobileSub>
        <MobileSub href="/shopping/icons/categories" pathname={pathname}>Przypisania ikon</MobileSub>
      </>
    );
  }
  if (id === "notes") {
    return (
      <div className="mb-1">
        {[{ href: "/notes/all", label: "Wszystkie" }, { href: "/notes/groups", label: "Grupy" }, { href: "/notes/tags", label: "Tagi" }].map(({ href, label }) => (
          <MobileSub key={href} href={href} pathname={pathname}>{label}</MobileSub>
        ))}
      </div>
    );
  }
  if (id === "kitchen") {
    return (
      <div className="mb-1">
        {[
          { href: "/kitchen/recipes", label: "Przepisy" },
          { href: "/kitchen/plan", label: "Plan" },
          { href: "/kitchen/pantry", label: "Spiżarnia" },
          { href: "/kitchen/cookbooks", label: "Książki" },
        ].map(({ href, label }) => (
          <MobileSub key={href} href={href} pathname={pathname}>{label}</MobileSub>
        ))}
      </div>
    );
  }
  return null;
}

function MobileItem({ href, exact, pathname, locked, children }: { href: string; exact?: boolean; pathname: string; locked?: boolean; children: React.ReactNode }) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  if (locked) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm" style={{ opacity: 0.35, cursor: "not-allowed", color: "var(--text-secondary)" }} title="Niedostępne dla Twojej roli">
        {children}<Lock size={11} style={{ marginLeft: "auto", flexShrink: 0, color: "var(--text-muted)" }} />
      </div>
    );
  }
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm" style={{ backgroundColor: isActive ? "var(--bg-elevated)" : undefined, color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
      {children}
    </Link>
  );
}

function MobileSub({ href, pathname, locked, children }: { href: string; pathname: string; locked?: boolean; children: React.ReactNode }) {
  const isActive = pathname === href || pathname.startsWith(href + "/");
  if (locked) {
    return (
      <div className="flex items-center gap-2 py-2 mx-2 rounded text-sm" style={{ paddingLeft: 52, opacity: 0.35, cursor: "not-allowed", color: "var(--text-muted)" }}>
        {children}
      </div>
    );
  }
  return (
    <Link href={href} className="flex items-center gap-2 py-2 mx-2 rounded text-sm" style={{ paddingLeft: 52, backgroundColor: isActive ? "var(--bg-elevated)" : undefined, color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}>
      {children}
    </Link>
  );
}
