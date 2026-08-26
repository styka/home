"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Calendar, Settings, Mail, Shield, Map, Image as ImageIcon, Lock, MoreHorizontal, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AppName } from "@/components/brand/AppName";
import { ModuleSidebar } from "./ModuleSidebar";
import { DataFreshness } from "./DataFreshness";
import { AICommandSheet } from "@/components/assistant/AICommandSheet";
import { ConsentBanner } from "@/components/legal/ConsentBanner";
import { FeedbackInspector } from "./FeedbackInspector";
import { PromptWznowieniaDialog } from "./PromptWznowieniaDialog";
import { NotificationBell } from "./NotificationBell";
import { ToastProvider } from "@/components/ui/Toast";
import { SpeechFallbackNotice } from "@/components/shell/SpeechFallbackNotice";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { ConflictProvider } from "@/components/ui/ConflictProvider";
import { ShortcutsProvider } from "./ShortcutsProvider";
import { ShortcutsCheatSheet } from "@/components/shortcuts/ShortcutsCheatSheet";
import { isPathLocked } from "@/lib/pathPermissions";
import { MODULES, resolveMenu, pozycjePaska, defaultMenuPrefs, type MenuPrefs } from "@/lib/modules";
import { updateMenuPrefs } from "@/actions/menuPrefs";
import { PasekKciukaPolaczony } from "./PasekKciukaPolaczony";
import { TrybAdminaProvider } from "@/platform/admin/trybAdmina";
import { KosztToasts } from "@/components/ui/KosztToasts";
import { PrzelacznikTrybuAdmina } from "@/components/ui/PrzelacznikTrybuAdmina";
import { FavoritesOverlay } from "@/components/favorites/FavoritesOverlay";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";
import { DEFAULT_USD_PLN_RATE } from "@/lib/usdPln";

interface AppShellProps {
  children: React.ReactNode;
  invitationCount?: number;
  isAdmin?: boolean;
  userRoles?: string[];
  userPermissions?: string[];
  menuPrefs?: MenuPrefs;
  usdPlnRate?: number;
  favoriteViews?: FavoriteViewDTO[];
  /** 083: czy administrator może włączyć pokazywanie kosztów AI (uprawnienie + wyłącznik systemowy). */
  /** 085: czy przełącznik trybu administratora ma się pojawić (konto administratora). */
  trybAdminaDostepny?: boolean;
}

// Pozycje dolne (stałe, niepodlegające konfiguracji) — do wykrywania aktywnego modułu i paska górnego.
type BottomItem = { id: string; label: string; href: string; Icon: LucideIcon; color: string; exact?: boolean };
const BOTTOM_ITEMS: BottomItem[] = [
  { id: "settings",    label: "Ustawienia",  href: "/settings",    Icon: Settings, color: "var(--text-secondary)" },
  { id: "invitations", label: "Zaproszenia", href: "/invitations", Icon: Mail,     color: "var(--text-secondary)" },
  { id: "admin",       label: "Admin",       href: "/admin",       Icon: Shield,   color: "var(--accent-purple)" },
];

export function AppShell({ children, invitationCount = 0, isAdmin = false, userRoles = [], userPermissions = [], menuPrefs = defaultMenuPrefs(), usdPlnRate = DEFAULT_USD_PLN_RATE, favoriteViews = [], trybAdminaDostepny = false }: AppShellProps) {
  const t = useTranslations("components.shell.AppShell");
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

  // Zapisz strefę czasową przeglądarki w ciasteczku, by serwer liczył granice doby
  // (widoki „Dziś"/„Nadchodzące"/„Zaległe" w Zadaniach) w strefie użytkownika.
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && document.cookie.indexOf(`tz=${tz}`) === -1) {
        document.cookie = `tz=${tz}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {
      // brak Intl / TZ — serwer użyje domyślnej strefy
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  /**
   * 103: dolny pasek nie jest już listą modułów — skład (kotwice + moduły) liczy czysta funkcja
   * w korzeniu kompozycji, bo tę samą arytmetykę czyta ekran ustawień menu.
   */
  const domDostepny = !isLocked("/");
  const { dalekie, bliskie } = pozycjePaska(userPermissions, menuPrefs, domDostepny);
  const reka = menuPrefs.handedness;

  return (
    /* 085: dostawca trybu administratora obejmuje CAŁĄ powłokę — wskaźniki kosztu siedzą
       w modułach, powiadomienia w rogu ekranu, narzędzia w warstwie pływającej; wszystkie czytają
       ten sam stan, więc jeden przełącznik chowa je razem. */
    <TrybAdminaProvider dostepne={trybAdminaDostepny}>
    <ToastProvider>
    <ConfirmProvider>
    <ConflictProvider>
    {/* 043: JEDEN nasłuchiwacz klawiatury dla całej aplikacji, z rejestrem skrótów.
        Musi opakowywać `children`, bo to strony modułów rejestrują swoje skróty (i mają
        pierwszeństwo przed globalnymi). */}
    <ShortcutsProvider>
    <DataFreshness />
    {/* 083: ulotne powiadomienia o koszcie AI — montowane RAZ, nad wszystkim (patrz komponent).
        085 (AC-8): same decydują, czy się rysować — czytają tryb administratora z kontekstu. */}
    <KosztToasts rate={usdPlnRate} />
    {/* 080 (Z4): informacja o zejściu lektora na głos systemowy — dotyczy każdego lektora w aplikacji. */}
    <SpeechFallbackNotice />
    <div
      // 036: `h-screen`, NIE `h-full`. Próba z `h-full` (=100% wysokości `body`) miała zapobiec
      // przewijaniu dokumentu przy klawiaturze, ale pomiar na urządzeniu pokazał, że nie zapobiega
      // (`scrollY` spadło tylko 335 → 291), a przy schowanej klawiaturze zaniżała wysokość okna
      // o ~44 px — na dole ekranu robił się jasny pasek. Przewijanie blokujemy inaczej: `overflow`
      // na elemencie `html` na czas otwartego okna pełnoekranowego (patrz `AICommandSheet`).
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
        {/* 100 (AC-12, AC-22): górny pasek telefonu idzie za DOMINUJĄCĄ RĘKĄ, tak jak rząd chromu
            na komputerze — ta sama reguła `.omnia-chrom-konta`, ten sam atrybut `html[data-reka]`.
            Bez tego gwiazdka ulubionych zostawałaby po prawej u osoby leworęcznej, a właściciel
            prosił o lustrzenie wprost także dla niej. W `row-reverse` `ml-auto` niżej przesuwa grupę
            chromu na wizualnie LEWĄ krawędź, więc marginesów nie trzeba ruszać. */}
        <div className="omnia-chrom-konta flex items-center gap-2 px-3" style={{ height: 44 }}>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded flex-shrink-0"
            style={{ color: "var(--text-secondary)", position: "relative" }}
            aria-label={t("otworzMenu")}
          >
            <Menu size={18} />
            {invitationCount > 0 && (
              <span style={{ position: "absolute", top: 2, right: 2, background: "var(--accent-red)", borderRadius: "50%", width: 8, height: 8 }} />
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

          {/* Prawa strona paska: powiadomienia (wszyscy). Admiński „zgłoś błąd"
              jest pływającym przyciskiem (FeedbackInspector) — działa też nad
              modalem, czego przycisk w pasku (pod modalem) nie potrafił. */}
          <div className="ml-auto flex items-center flex-shrink-0">
            {/* 103 (AC-10): gwiazdka ulubionych ZNIKA z górnego paska telefonu i staje się kotwicą
                paska DOLNEGO. Zgłoszenie właściciela: „Powinna tam być ikona ulubionych czyli
                gwiazdka (zamiast na górnym pasku)". Powód jest ergonomiczny, nie estetyczny: górna
                krawędź telefonu jest poza zasięgiem kciuka trzymającego urządzenie, a zapisanie
                widoku to czynność wykonywana wielokrotnie dziennie. Na komputerze gwiazdka zostaje
                w rzędzie chromu konta (`FavoriteStarButton` z wariantem `chrome`) — tam ograniczenia
                zasięgu nie ma, a rząd chromu jest jej ustalonym miejscem od 086. */}
            {/* 085: przełącznik TRYBU ADMINISTRATORA stoi obok dzwonka — w chromie konta. */}
            <PrzelacznikTrybuAdmina />
            <NotificationBell placement="topbar" />
          </div>
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
                    <MoreHorizontal size={20} /><span>{t("wiecej")}</span>
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

            </nav>

            <div className="py-2 border-t" style={{ borderColor: "var(--border)", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
              <MobileItem href="/invitations" pathname={pathname} locked={isLocked("/invitations")}>
                <Mail size={20} /><span>Zaproszenia</span>
                {invitationCount > 0 && (
                  <span style={{ marginLeft: "auto", background: "var(--accent-red)", color: "var(--on-accent)", fontSize: 11, borderRadius: 999, padding: "1px 6px" }}>{invitationCount}</span>
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

      <ModuleSidebar invitationCount={invitationCount} isAdmin={isAdmin} userRoles={userRoles} userPermissions={userPermissions} menuPrefs={menuPrefs} favoriteViews={favoriteViews} />

      {/**
       * 085: powłoka NIE wstrzykuje już nic do paska widoku.
       *
       * Od 045 wkładała tam trzy rzeczy: gwiazdkę ulubionych, wskaźnik świeżości i wejście do
       * ściągawki skrótów. Wszystkie trzy stąd wyszły — gwiazdka i ściągawka do rzędu chromu konta
       * (obok dzwonka), a wskaźnik świeżości zniknął, bo mierzył moment automatycznego
       * przeładowania strony przez powłokę, a nie świeżość danych modułu; jego treść wprowadzała
       * w błąd. Mechanizm bez zawartości byłby martwym API w miejscu wspólnym, więc znika razem
       * z nimi (C-35 czytane w drugą stronę).
       *
       * Pasek widoku ZOSTAJE: nadal rysuje go `ModuleView` osadzony w stronie modułu, bo powłoka
       * nie zna tytułu modułu i dostałaby podwójne nagłówki w ~20 modułach.
       */}
      {/* 100: `pb-16`, nie `pb-14` — magiczna ikona wystaje 14 px ponad krawędź paska, więc bez
          tego zjadałaby ostatni wiersz każdej długiej listy (AC-19). */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 pb-16 md:pb-0">
        {children}
      </main>

      {/* 100: dolny pasek to teraz PASEK KCIUKA — układ lustrzany wg ręki, magiczna ikona na
          stałe na środku, a przytrzymanie dowolnej pozycji otwiera wachlarz nawigacji. */}
      <PasekKciukaPolaczony
        dalekie={dalekie}
        bliskie={bliskie}
        reka={reka}
        pathname={pathname}
        favoriteViews={favoriteViews}
        userPermissions={userPermissions}
        moduly={enabled}
      />

      <FavoritesOverlay favorites={favoriteViews} userPermissions={userPermissions} />
      <ShortcutsCheatSheet />
      <AICommandSheet isAdmin={isAdmin} usdPlnRate={usdPlnRate} />
      <ConsentBanner />
      {/* 085 (AC-8): pływający przycisk zgłaszania i tryb wskazywania to NARZĘDZIE administratora —
          przy wyłączonym trybie znika razem z resztą dodatków. Sam komponent pilnuje też skrótu
          klawiszowego: ukryte narzędzie, które nadal daje się odpalić, wygląda na usterkę. */}
      {isAdmin && <FeedbackInspector />}
      {/* 106: przypomnienie o przerwanej robocie — dialog, nie powiadomienie, i nie częściej
          niż raz dziennie. Pilnuje tego akcja serwerowa (data w strefie użytkownika), nie
          komponent: powłoka montuje się przy każdym pełnym wejściu na stronę. */}
      {isAdmin && <PromptWznowieniaDialog />}
    </div>
    </ShortcutsProvider>
    </ConflictProvider>
    </ConfirmProvider>
    </ToastProvider>
    </TrybAdminaProvider>
  );
}

/** Mobilna sub-nawigacja modułu (tylko tam, gdzie miała sens w drawerze). */
function MobileModuleSubNav({ id, pathname }: { id: string; pathname: string }) {
  const t = useTranslations("components.shell.AppShell");
  if (id === "shopping") {
    return (
      <>
        <MobileSub href="/shopping/stores" pathname={pathname}><Map size={13} />{t("mapySklepow")}</MobileSub>
        <MobileSub href="/shopping/icons" pathname={pathname}><ImageIcon size={13} />Biblioteka ikon</MobileSub>
        <MobileSub href="/shopping/icons/categories" pathname={pathname}>Przypisania ikon</MobileSub>
      </>
    );
  }
  if (id === "notes") {
    return (
      <div className="mb-1">
        {[{ href: "/notes/all", label: "Wszystkie" }, { href: "/notes/groups", label: "Foldery" }, { href: "/notes/tags", label: "Tagi" }].map(({ href, label }) => (
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
  const t = useTranslations("components.shell.AppShell");
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  if (locked) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 mx-2 rounded text-sm" style={{ opacity: 0.35, cursor: "not-allowed", color: "var(--text-secondary)" }} title={t("niedostepneDlaTwojejRoli")}>
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
