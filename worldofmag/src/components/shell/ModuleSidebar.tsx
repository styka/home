"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, Briefcase, Settings, Mail, Shield, FolderOpen, Tag, Lock, BookOpen, Package, BookMarked, CalendarDays, MoreHorizontal, Plus } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AppName } from "@/components/brand/AppName";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/cn";
import { TasksSideNav } from "@/components/tasks/TasksSideNav";
import { ShoppingSideNav } from "@/components/shopping/ShoppingSideNav";
import { PetsSideNav } from "@/components/pets/PetsSideNav";
import { LanguagesSideNav } from "@/components/languages/LanguagesSideNav";
import { FlotaSideNav } from "@/components/flota/FlotaSideNav";
import { PortfelSideNav } from "@/components/portfel/PortfelSideNav";
import { isPathLocked } from "@/lib/permissions";
import { resolveMenu, defaultMenuPrefs, type MenuPrefs, type ModuleDef } from "@/lib/modules";
import { updateMenuPrefs } from "@/actions/menuPrefs";

interface ModuleSidebarProps {
  invitationCount?: number;
  isAdmin?: boolean;
  userRoles?: string[];
  userPermissions?: string[];
  menuPrefs?: MenuPrefs;
}

/** Sub-nawigacja danego modułu (renderowana, gdy moduł jest aktywny). */
function ModuleSubNav({ id, pathname }: { id: string; pathname: string }) {
  switch (id) {
    case "shopping":
      return (
        <div className="mb-1">
          <ShoppingSideNav />
          {pathname.startsWith("/shopping/icons") && (
            <NavSubItem href="/shopping/icons/categories" label="Przypisania" pathname={pathname} />
          )}
        </div>
      );
    case "notes":
      return (
        <div className="mb-1">
          <NavSubItem href="/notes/all" label="Wszystkie" pathname={pathname} />
          <NavSubItem href="/notes/groups" label="Grupy" icon={<FolderOpen size={12} />} pathname={pathname} />
          <NavSubItem href="/notes/tags" label="Tagi" icon={<Tag size={12} />} pathname={pathname} />
        </div>
      );
    case "tasks":
      return <div className="mb-1"><TasksSideNav /></div>;
    case "pets":
      return <div className="mb-1"><PetsSideNav /></div>;
    case "kitchen":
      return (
        <div className="mb-1">
          <NavSubItem href="/kitchen/recipes" label="Przepisy" icon={<BookMarked size={12} />} pathname={pathname} />
          <NavSubItem href="/kitchen/plan" label="Plan" icon={<CalendarDays size={12} />} pathname={pathname} />
          <NavSubItem href="/kitchen/pantry" label="Spiżarnia" icon={<Package size={12} />} pathname={pathname} />
          <NavSubItem href="/kitchen/cookbooks" label="Książki" icon={<BookOpen size={12} />} pathname={pathname} />
        </div>
      );
    case "languages":
      return <div className="mb-1"><LanguagesSideNav /></div>;
    case "qa":
      return (
        <div className="mb-1">
          <NavSubItem href="/qa/shopping" label="Zakupy" pathname={pathname} />
          <NavSubItem href="/qa/tasks" label="Zadania" pathname={pathname} />
          <NavSubItem href="/qa/notes" label="Notatki" pathname={pathname} />
          <NavSubItem href="/qa/kitchen" label="Kuchnia" pathname={pathname} />
        </div>
      );
    case "flota":
      return <div className="mb-1"><FlotaSideNav /></div>;
    case "portfel":
      return <div className="mb-1"><PortfelSideNav /></div>;
    default:
      return null;
  }
}

function NavItem({
  href,
  label,
  icon,
  pathname,
  exact = false,
  accentColor,
  iconColor,
  locked,
  children,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
  exact?: boolean;
  accentColor?: string;
  iconColor?: string;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const activeColor = accentColor ?? "var(--text-primary)";

  if (locked) {
    return (
      <div
        className={cn("flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm")}
        style={{ opacity: 0.35, cursor: "not-allowed", color: "var(--text-secondary)" }}
        title="Niedostępne dla Twojej roli"
      >
        {iconColor ? <span style={{ color: iconColor, flexShrink: 0, display: "flex" }}>{icon}</span> : icon}
        <span>{label}</span>
        <Lock size={10} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm")}
      style={{
        backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
        color: isActive ? activeColor : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.color = accentColor ?? "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
    >
      {iconColor ? <span style={{ color: iconColor, flexShrink: 0, display: "flex" }}>{icon}</span> : icon}
      <span>{label}</span>
      {children}
    </Link>
  );
}

function NavSubItem({
  href,
  label,
  icon,
  pathname,
  locked,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  pathname: string;
  locked?: boolean;
}) {
  const isActive = pathname === href || pathname.startsWith(href + "/");

  if (locked) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs" style={{ paddingLeft: 40, opacity: 0.35, cursor: "not-allowed", color: "var(--text-muted)" }}>
        {icon}{label}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs"
      style={{
        paddingLeft: 40,
        backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.color = "var(--text-muted)";
        }
      }}
    >
      {icon}{label}
    </Link>
  );
}

export function ModuleSidebar({ invitationCount = 0, isAdmin = false, userRoles = [], userPermissions = [], menuPrefs = defaultMenuPrefs() }: ModuleSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [, startTransition] = useTransition();

  const { enabled, more } = resolveMenu(userPermissions, menuPrefs);

  function isLocked(href: string): boolean {
    return isPathLocked(userPermissions, href);
  }

  // Włącz wyłączony moduł („Więcej…") — usuń go z listy `disabled`.
  function enableModule(id: string) {
    const nextDisabled = menuPrefs.disabled.filter((d) => d !== id);
    startTransition(async () => {
      await updateMenuPrefs({ disabled: nextDisabled });
      router.refresh();
    });
  }

  function renderModule(m: ModuleDef) {
    const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
    return (
      <div key={m.id}>
        <NavItem href={m.href} label={m.label} icon={<m.Icon size={18} />} pathname={pathname} exact={m.exact} iconColor={m.color} />
        {active && <ModuleSubNav id={m.id} pathname={pathname} />}
      </div>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col h-full border-r"
      style={{
        width: "var(--sidebar-width)",
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
        flexShrink: 0,
      }}
    >
      {/* Logo → strona główna */}
      <Link
        href="/"
        className="flex items-center gap-2 px-4 h-12 border-b"
        style={{ borderColor: "var(--border)", textDecoration: "none" }}
        title="Strona główna"
      >
        <BrandLogo px={20} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
          <AppName />
        </span>
      </Link>

      {/* Modules — tylko dostępne i włączone, w kolejności użytkownika */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {enabled.map(renderModule)}

        {/* „Więcej…" — działy dostępne, ale wyłączone przez użytkownika */}
        {more.length > 0 && (
          <>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm w-[calc(100%-1rem)] focus:outline-none"
              style={{ color: "var(--text-muted)" }}
            >
              <MoreHorizontal size={18} />
              <span>Więcej…</span>
            </button>
            {moreOpen && more.map((m) => (
              <button
                key={m.id}
                onClick={() => enableModule(m.id)}
                className="flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm w-[calc(100%-1rem)] focus:outline-none"
                style={{ color: "var(--text-secondary)", opacity: 0.85 }}
                title={`Włącz „${m.label}" w menu`}
              >
                <span style={{ color: m.color, flexShrink: 0, display: "flex" }}><m.Icon size={18} /></span>
                <span>{m.label}</span>
                <Plus size={13} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />
              </button>
            ))}
          </>
        )}

        {/* Inactive modules (coming soon — nie zależą od uprawnień) */}
        {[
          { label: "Work", icon: <Briefcase size={18} />, href: "/work" },
        ].map((mod) => (
          <div
            key={mod.href}
            title={`${mod.label} (coming soon)`}
            className="flex items-center gap-3 px-4 py-2 mx-2 rounded cursor-not-allowed"
            style={{ opacity: 0.35, color: "var(--text-secondary)" }}
          >
            {mod.icon}
            <span className="text-sm">{mod.label}</span>
          </div>
        ))}
      </nav>

      {/* Bottom: Powiadomienia + Invitations + Settings + Admin */}
      <div className="py-2 border-t" style={{ borderColor: "var(--border)" }}>
        <NotificationBell placement="sidebar" />

        <NavItem href="/invitations" label="Zaproszenia" icon={<Mail size={18} />} pathname={pathname} locked={isLocked("/invitations")}>
          {invitationCount > 0 && !isLocked("/invitations") && (
            <span
              style={{
                marginLeft: "auto",
                background: "#ef4444",
                color: "var(--on-accent)",
                fontSize: 11,
                borderRadius: 999,
                padding: "1px 6px",
                minWidth: 18,
                textAlign: "center",
              }}
            >
              {invitationCount}
            </span>
          )}
        </NavItem>

        <NavItem href="/settings" label="Ustawienia" icon={<Settings size={18} />} pathname={pathname} locked={isLocked("/settings")} />

        {isAdmin && (
          <NavItem href="/admin" label="Admin" icon={<Shield size={18} />} pathname={pathname} accentColor="var(--accent-purple)" />
        )}
      </div>
    </aside>
  );
}
