"use client";

// 116 — wariant układu `pasek-gorny`: nawigacja pozioma u góry (tylko komputer).
//
// Renderowany przez `AppShell` ZAMIAST `ModuleSidebar`, gdy aktywna skórka zaawansowana
// wybrała ten wariant. Żywi się tą samą listą modułów z `resolveMenu` (żadnej równoległej
// listy — C-36) i przenosi CAŁY chrom konta (gwiazdka ulubionych, tryb admina, dzwonek,
// czat), żeby zmiana układu niczego nie odbierała. Poniżej `md` nie istnieje — telefon
// zachowuje górny pasek + pasek kciuka bez zmian (C-31).
//
// Świadome ograniczenie wariantu: pozioma listwa nie mieści bocznej pod-nawigacji modułu
// (`ModuleSubNav`) — pod-strony pozostają dostępne z widoków modułu i z wachlarza.

import Link from "next/link";
import { Settings, Mail, Shield, Lock } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AppName } from "@/components/brand/AppName";
import { NotificationBell } from "./NotificationBell";
import { IkonaCzatu } from "./IkonaCzatu";
import { PrzelacznikTrybuAdmina } from "@/components/ui/PrzelacznikTrybuAdmina";
import { FavoriteStarButton } from "@/components/favorites/FavoriteStarButton";
import type { FavoriteViewDTO } from "@/platform/favorites/favoriteViews";
import type { ModuleDef } from "@/lib/modules";

export function PoziomyPasekModulow({
  moduly,
  pathname,
  invitationCount,
  isAdmin,
  favoriteViews,
  isLocked,
}: {
  moduly: ModuleDef[];
  pathname: string;
  invitationCount: number;
  isAdmin: boolean;
  favoriteViews: FavoriteViewDTO[];
  isLocked: (href: string) => boolean;
}) {
  return (
    <div
      className="omnia-nawigacja hidden md:flex items-center gap-1 border-b px-3 flex-shrink-0"
      style={{ height: 48, backgroundColor: "var(--chrome-bg, var(--bg-surface))", borderColor: "var(--chrome-border, var(--border))" }}
    >
      <div className="flex items-center gap-2 pr-2 flex-shrink-0">
        <BrandLogo px={20} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
          <AppName />
        </span>
      </div>

      <nav className="flex items-center gap-0.5 overflow-x-auto min-w-0 flex-1">
        {moduly.map((m) => {
          const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
          return (
            <Link
              key={m.id}
              href={m.href}
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm whitespace-nowrap"
              style={{
                backgroundColor: active ? "var(--bg-elevated)" : undefined,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <m.Icon size={16} style={{ color: m.color, flexShrink: 0 }} />
              <span className="hidden lg:inline">{m.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="omnia-chrom-konta ml-auto flex items-center gap-1 flex-shrink-0">
        <FavoriteStarButton favorites={favoriteViews} placement="chrome" />
        <PrzelacznikTrybuAdmina />
        <NotificationBell placement="chrome" />
        <IkonaCzatu placement="chrome" />
        <PasekLink href="/settings" title="Ustawienia" locked={isLocked("/settings")} active={pathname.startsWith("/settings")}>
          <Settings size={16} />
        </PasekLink>
        <PasekLink href="/invitations" title="Zaproszenia" locked={isLocked("/invitations")} active={pathname.startsWith("/invitations")}>
          <Mail size={16} />
          {invitationCount > 0 && (
            <span
              style={{
                position: "absolute", top: 2, right: 2, background: "var(--accent-red)",
                color: "var(--on-accent)", fontSize: 9, borderRadius: 999, padding: "0 4px", lineHeight: "12px",
              }}
            >
              {invitationCount}
            </span>
          )}
        </PasekLink>
        {isAdmin && (
          <PasekLink href="/admin" title="Admin" active={pathname.startsWith("/admin")}>
            <Shield size={16} style={{ color: "var(--accent-purple)" }} />
          </PasekLink>
        )}
      </div>
    </div>
  );
}

function PasekLink({
  href,
  title,
  locked,
  active,
  children,
}: {
  href: string;
  title: string;
  locked?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  if (locked) {
    return (
      <span className="relative flex h-8 w-8 items-center justify-center rounded" style={{ opacity: 0.35, color: "var(--text-muted)" }} title={title}>
        <Lock size={14} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className="relative flex h-8 w-8 items-center justify-center rounded"
      style={{ backgroundColor: active ? "var(--bg-elevated)" : undefined, color: active ? "var(--text-primary)" : "var(--text-secondary)" }}
    >
      {children}
    </Link>
  );
}
