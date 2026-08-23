"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings2, ChevronRight, ChevronDown } from "lucide-react";
import { updateMenuPrefs } from "@/actions/menuPrefs";
import { openFavoritesSwitcher } from "@/platform/favorites/favoritesBus";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";
import { isPathLocked } from "@/lib/pathPermissions";

interface FavoritesSidebarSectionProps {
  favorites: FavoriteViewDTO[];
  userPermissions: string[];
  /** 080 (Z8): stan zwinięcia z `UserMenuPref` — zapamiętany, a nie liczony od nowa na stronę. */
  collapsed?: boolean;
}

const VISIBLE_LIMIT = 6;

/**
 * 042: sekcja ulubionych w pasku bocznym (desktop). Pokazuje kilka pierwszych pozycji, resztę
 * chowa za „Wszystkie ulubione" otwierającym przełącznik z wyszukiwaniem — dzięki temu długa
 * lista nie rozpycha nawigacji modułów.
 *
 * 043: sekcja renderuje się ZAWSZE, także przy zerze wpisów (AC-1). W 042 zwracała `null`, co
 * w praktyce znaczyło „funkcji nie ma na komputerze" — właściciel zgłosił to jako błąd i miał
 * rację: skoro jedyny punkt zapisu też był schowany na dole paska, nie było skąd się dowiedzieć,
 * że ulubione w ogóle istnieją. Teraz sekcja niesie trzy rzeczy w stałej kolejności: punkt zapisu
 * bieżącego widoku (AC-2), zarządzanie (AC-3) i listę.
 */
export function FavoritesSidebarSection({ favorites, userPermissions, collapsed = true }: FavoritesSidebarSectionProps) {
  const t = useTranslations("components.favorites.FavoritesSidebarSection");
  const pathname = usePathname();
  const accessible = filterAccessibleFavorites(favorites, userPermissions, isPathLocked);

  const visible = accessible.slice(0, VISIBLE_LIMIT);
  const hiddenCount = accessible.length - visible.length;

  /**
   * 080 (Z8): sekcja zwija się do JEDNEGO wiersza z licznikiem.
   *
   * Zgłoszenie właściciela: „zawsze ma w tym menu najpierw do pokonania szum w postaci dużego
   * obszaru ulubione" — żeby wejść na stronę główną albo do notatek. Rozwinięta sekcja to
   * nagłówek, punkt zapisu widoku i do sześciu pozycji, czyli u góry menu potrafiło stać osiem
   * wierszy, zanim zaczynały się moduły.
   *
   * Stan trzymamy optymistycznie w komponencie i zapisujemy w tle. Czekanie na odpowiedź serwera
   * przy rozwijaniu listy byłoby widoczne jako zacinanie się menu, a koszt pomyłki to jedno
   * kliknięcie.
   */
  const [zwinieta, setZwinieta] = useState(collapsed);
  const [, startTransition] = useTransition();

  function przelacz() {
    const next = !zwinieta;
    setZwinieta(next);
    startTransition(async () => {
      try {
        await updateMenuPrefs({ favoritesCollapsed: next });
      } catch {
        setZwinieta(!next); // zapis się nie udał — stan nie może kłamać po przeładowaniu
      }
    });
  }

  return (
    <div style={{ paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid var(--border)" }}>
      <div
        className="flex items-center gap-2 px-4"
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}
      >
        {/* Cały nagłówek jest przełącznikiem — mały trójkącik obok tekstu byłby celem dotyku
            poniżej minimum z C-31, a nagłówek i tak nie robił dotąd nic innego. */}
        <button
          onClick={przelacz}
          aria-expanded={!zwinieta}
          // `aria-label` jest tu KONIECZNE, a nie ozdobne: nazwą dostępną przycisku byłaby inaczej
          // jego treść („Ulubione · 4"), czyli nazwa sekcji, a nie czynność. Czytnik ekranu (i test
          // klikacza) nie miałby z czego wywnioskować, że kliknięcie rozwija listę.
          aria-label={
            zwinieta
              ? `${t("rozwinUlubione")}${accessible.length > 0 ? ` (${accessible.length})` : ""}`
              : t("zwinUlubione")
          }
          title={zwinieta ? t("rozwinUlubione") : t("zwinUlubione")}
          className="flex flex-1 items-center gap-2 py-3 text-left focus:outline-none"
          style={{
            background: "none", border: "none", cursor: "pointer", color: "inherit",
            font: "inherit", letterSpacing: "inherit", textTransform: "inherit", padding: 0,
            minWidth: 0,
          }}
        >
          {zwinieta ? <ChevronRight size={11} style={{ flexShrink: 0 }} /> : <ChevronDown size={11} style={{ flexShrink: 0 }} />}
          {/* 083: etykieta sekcji BEZ ikony gwiazdki. Gwiazdka ma w całej aplikacji jedno znaczenie —
              „zapisz/odznacz ten widok" — i stoi wyłącznie w pasku widoku. Etykieta obok akcji o tym
              samym symbolu była jedną z czterech gwiazdek, które właściciel widział naraz. */}
          <span className="truncate">Ulubione</span>
          {/* Licznik w zwiniętym wierszu: sekcja ma być mała, ale nie niewidoczna. */}
          {zwinieta && accessible.length > 0 && (
            <span style={{ color: "var(--text-muted)", opacity: 0.8 }}>· {accessible.length}</span>
          )}
        </button>
        <Link
          href="/settings#ulubione"
          title={t("zarzadzajUlubionymiNazwaIkona")}
          aria-label={t("zarzadzajUlubionymi")}
          style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
        >
          <Settings2 size={12} />
        </Link>
      </div>

      {/* 083: przycisk „Zapisz ten widok" ZNIKA stąd. Ta sama akcja stała w trzech miejscach naraz
          (tu, w mobilnym pasku powłoki i w pasku widoku) — przy jednej akcji trzy wejścia nie dają
          wyboru, tylko pytanie „które z nich jest właściwe". Zostaje jedno: pasek widoku, bo to on
          opisuje widok, który się zapisuje. Sekcja pozostaje tym, czym jest: LISTĄ zapisanych. */}

      {zwinieta ? null : accessible.length === 0 ? (
        <p
          className="px-4"
          style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.45, margin: "6px 0 2px" }}
        >
          {t("nieMaszJeszczeZapisanych")}
        </p>
      ) : (
        <>
          <div style={{ height: 4 }} />
          {visible.map((f, i) => {
            const isActive = pathname === f.path.split("?")[0];
            return (
              <Link
                key={f.id}
                href={f.path}
                title={f.label}
                className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs"
                style={{
                  textDecoration: "none",
                  backgroundColor: isActive ? "var(--bg-elevated)" : undefined,
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "var(--text-muted)"; } }}
              >
                <span style={{ width: 14, textAlign: "center", flexShrink: 0 }}>{f.icon}</span>
                <span className="truncate flex-1">{f.label}</span>
                {i < 9 && (
                  <kbd style={{ fontSize: 9, color: "var(--text-muted)", opacity: 0.7, flexShrink: 0 }}>⌥{i + 1}</kbd>
                )}
              </Link>
            );
          })}

          <button
            onClick={openFavoritesSwitcher}
            className="flex items-center gap-2 px-4 py-1.5 mx-2 rounded text-xs w-[calc(100%-1rem)] focus:outline-none"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            title="Wszystkie ulubione (Alt+0)"
          >
            <Search size={11} style={{ flexShrink: 0 }} />
            <span>{hiddenCount > 0 ? `Wszystkie ulubione (+${hiddenCount})` : "Wszystkie ulubione"}</span>
          </button>
        </>
      )}
    </div>
  );
}
