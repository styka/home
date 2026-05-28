"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, ShoppingCart, Calendar, FileText, Briefcase, Settings, Mail, Shield, CheckSquare, Home, Map, Image, Lock, BookOpen, ChefHat, FlaskConical, Truck, PawPrint } from "lucide-react";
import { ModuleSidebar } from "./ModuleSidebar";
import { AICommandSheet } from "@/components/home/AICommandSheet";
import { ToastProvider } from "@/components/ui/Toast";
import { isPathLocked } from "@/lib/permissions";
import { APP_NAME } from "@/lib/appName";

interface AppShellProps {
  children: React.ReactNode;
  invitationCount?: number;
  isAdmin?: boolean;
  userRoles?: string[];
  userPermissions?: string[];
}

const MODULES = [
  { id: "home",        label: "Strona główna", icon: <Home size={20} />,        topBarIcon: <Home size={16} />,        color: "var(--text-secondary)",  href: "/",            active: true,  exact: true  },
  { id: "shopping",    label: "Zakupy",        icon: <ShoppingCart size={20} />, topBarIcon: <ShoppingCart size={16} />, color: "var(--accent-blue)",     href: "/shopping",    active: true,  exact: false },
  { id: "tasks",       label: "Zadania",       icon: <CheckSquare size={20} />,  topBarIcon: <CheckSquare size={16} />,  color: "var(--accent-green)",    href: "/tasks",       active: true,  exact: false },
  { id: "notes",       label: "Notatki",       icon: <FileText size={20} />,     topBarIcon: <FileText size={16} />,     color: "var(--accent-amber)",    href: "/notes",       active: true,  exact: false },
  { id: "pets",        label: "Zwierzęta",     icon: <PawPrint size={20} />,     topBarIcon: <PawPrint size={16} />,     color: "var(--accent-orange)",   href: "/pets",        active: true,  exact: false },
  { id: "kitchen",     label: "Kuchnia",       icon: <ChefHat size={20} />,      topBarIcon: <ChefHat size={16} />,      color: "var(--accent-orange)",   href: "/kitchen",     active: true,  exact: false },
  { id: "qa",          label: "QA",            icon: <FlaskConical size={20} />, topBarIcon: <FlaskConical size={16} />, color: "var(--accent-red)",      href: "/qa",          active: true,  exact: false },
  { id: "truck",       label: "Trasy TIR",     icon: <Truck size={20} />,        topBarIcon: <Truck size={16} />,        color: "var(--accent-blue)",     href: "/truck",       active: true,  exact: false },
  { id: "calendar",    label: "Calendar",      icon: <Calendar size={20} />,     topBarIcon: <Calendar size={16} />,     color: "var(--text-muted)",      href: "/calendar",    active: false, exact: false },
  { id: "work",        label: "Work",          icon: <Briefcase size={20} />,    topBarIcon: <Briefcase size={16} />,    color: "var(--text-muted)",      href: "/work",        active: false, exact: false },
  { id: "settings",    label: "Ustawienia",    icon: null,                        topBarIcon: <Settings size={16} />,    color: "var(--text-secondary)",  href: "/settings",    active: false, exact: false },
  { id: "invitations", label: "Zaproszenia",   icon: null,                        topBarIcon: <Mail size={16} />,        color: "var(--text-secondary)",  href: "/invitations", active: false, exact: false },
  { id: "admin",       label: "Admin",         icon: null,                        topBarIcon: <Shield size={16} />,      color: "var(--accent-purple)",   href: "/admin",       active: false, exact: false },
];

export function AppShell({ children, invitationCount = 0, isAdmin = false, userRoles = [], userPermissions = [] }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const activeModule = MODULES.find((m) => m.exact ? pathname === m.href : pathname.startsWith(m.href));

  function isLocked(href: string): boolean {
    return isPathLocked(userPermissions, href);
  }

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const isShoppingActive = pathname.startsWith("/shopping");

  return (
    <ToastProvider>
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
          <div className="flex items-center gap-1.5">
            <span style={{ color: activeModule?.color ?? "var(--accent-purple)" }}>
              {activeModule?.topBarIcon ?? <Sparkles size={16} />}
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {activeModule?.label ?? APP_NAME}
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
            <div className="flex-shrink-0 border-b" style={{ borderColor: "var(--border)", paddingTop: "env(safe-area-inset-top)" }}>
              <div className="flex items-center justify-between px-4" style={{ height: 44 }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} style={{ color: "var(--accent-purple)" }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{APP_NAME}</span>
                </div>
                <button onClick={() => setMenuOpen(false)} className="flex items-center justify-center w-8 h-8 rounded" style={{ color: "var(--text-secondary)" }} aria-label="Zamknij menu">
                  <X size={16} />
                </button>
              </div>
            </div>

            <nav className="flex-1 py-2 overflow-y-auto">
              <MobileItem href="/" exact pathname={pathname} locked={isLocked("/")}>
                <Home size={20} style={{ color: "var(--text-secondary)", flexShrink: 0 }} /><span>Strona główna</span>
              </MobileItem>

              <MobileItem href="/shopping" pathname={pathname} locked={isLocked("/shopping")}>
                <ShoppingCart size={20} style={{ color: "var(--accent-blue)", flexShrink: 0 }} /><span>Zakupy</span>
              </MobileItem>
              {isShoppingActive && (
                <>
                  <MobileSub href="/shopping/stores" pathname={pathname} locked={isLocked("/shopping")}><Map size={13} />Mapy sklepów</MobileSub>
                  <MobileSub href="/shopping/icons" pathname={pathname} locked={isLocked("/shopping")}><Image size={13} />Biblioteka ikon</MobileSub>
                  <MobileSub href="/shopping/icons/categories" pathname={pathname} locked={isLocked("/shopping")}>Przypisania ikon</MobileSub>
                </>
              )}

              <MobileItem href="/tasks" pathname={pathname} locked={isLocked("/tasks")}>
                <CheckSquare size={20} style={{ color: "var(--accent-green)", flexShrink: 0 }} /><span>Zadania</span>
              </MobileItem>

              <MobileItem href="/notes" pathname={pathname} locked={isLocked("/notes")}>
                <FileText size={20} style={{ color: "var(--accent-amber)", flexShrink: 0 }} /><span>Notatki</span>
              </MobileItem>
              {pathname.startsWith("/notes") && (
                <div className="mb-1">
                  {[{ href: "/notes/all", label: "Wszystkie" }, { href: "/notes/groups", label: "Grupy" }, { href: "/notes/tags", label: "Tagi" }].map(({ href, label }) => (
                    <MobileSub key={href} href={href} pathname={pathname} locked={isLocked("/notes")}>{label}</MobileSub>
                  ))}
                </div>
              )}

              <MobileItem href="/pets" pathname={pathname} locked={isLocked("/pets")}>
                <PawPrint size={20} style={{ color: "var(--accent-orange)", flexShrink: 0 }} /><span>Zwierzęta</span>
              </MobileItem>

              <MobileItem href="/kitchen" pathname={pathname} locked={isLocked("/kitchen")}>
                <ChefHat size={20} style={{ color: "var(--accent-orange)", flexShrink: 0 }} /><span>Kuchnia</span>
              </MobileItem>
              {pathname.startsWith("/kitchen") && (
                <div className="mb-1">
                  {[
                    { href: "/kitchen/recipes",  label: "Przepisy" },
                    { href: "/kitchen/plan",     label: "Plan" },
                    { href: "/kitchen/pantry",   label: "Spiżarnia" },
                    { href: "/kitchen/cookbooks", label: "Książki" },
                  ].map(({ href, label }) => (
                    <MobileSub key={href} href={href} pathname={pathname} locked={isLocked("/kitchen")}>{label}</MobileSub>
                  ))}
                </div>
              )}

              <MobileItem href="/qa" pathname={pathname} locked={isLocked("/qa")}>
                <FlaskConical size={20} style={{ color: "var(--accent-red)", flexShrink: 0 }} /><span>QA</span>
              </MobileItem>

              <MobileItem href="/truck" pathname={pathname} locked={isLocked("/truck")}>
                <Truck size={20} style={{ color: "var(--accent-blue)", flexShrink: 0 }} /><span>Trasy TIR</span>
              </MobileItem>

              <MobileItem href="/reports" pathname={pathname} locked={isLocked("/reports")}>
                <BookOpen size={20} style={{ color: "var(--accent-purple)", flexShrink: 0 }} /><span>Raporty</span>
              </MobileItem>

              {[{ label: "Calendar", icon: <Calendar size={20} />, href: "/calendar" }, { label: "Work", icon: <Briefcase size={20} />, href: "/work" }].map((mod) => (
                <div key={mod.href} className="flex items-center gap-3 px-4 py-3 mx-2 rounded" style={{ opacity: 0.35, color: "var(--text-secondary)", cursor: "not-allowed" }} title={`${mod.label} (coming soon)`}>
                  {mod.icon}<span className="text-sm">{mod.label}</span>
                </div>
              ))}
            </nav>

            <div className="py-2 border-t" style={{ borderColor: "var(--border)", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
              <MobileItem href="/invitations" pathname={pathname} locked={isLocked("/invitations")}>
                <Mail size={20} /><span>Zaproszenia</span>
                {invitationCount > 0 && (
                  <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: 11, borderRadius: 999, padding: "1px 6px" }}>{invitationCount}</span>
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

      <ModuleSidebar invitationCount={invitationCount} isAdmin={isAdmin} userRoles={userRoles} userPermissions={userPermissions} />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0 pb-14 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
          height: "calc(56px + env(safe-area-inset-bottom))",
        }}
      >
        {[
          { href: "/", label: "Dom", icon: <Home size={20} />, exact: true, color: "var(--text-secondary)" },
          { href: "/shopping", label: "Zakupy", icon: <ShoppingCart size={20} />, exact: false, color: "var(--accent-blue)" },
          { href: "/tasks", label: "Zadania", icon: <CheckSquare size={20} />, exact: false, color: "var(--accent-green)" },
          { href: "/notes", label: "Notatki", icon: <FileText size={20} />, exact: false, color: "var(--accent-amber)" },
        ].map(({ href, label, icon, exact, color }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs"
              style={{ color: isActive ? color : "var(--text-muted)" }}
            >
              {icon}
              <span style={{ fontSize: 10 }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <AICommandSheet />
    </div>
    </ToastProvider>
  );
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
