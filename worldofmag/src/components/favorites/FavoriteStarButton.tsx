"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Star, X } from "lucide-react";
import { addFavoriteView, removeFavoriteViewByPath } from "@/actions/favoriteViews";
import {
  DEFAULT_FAVORITE_ICON,
  FAVORITE_COLORS,
  MAX_FAVORITE_LABEL_LENGTH,
  normalizeFavoritePath,
  suggestFavoriteLabel,
  type FavoriteViewDTO,
} from "@/platform/favorites/favoriteViews";
import { MODULES } from "@/lib/modules";

const ICON_CHOICES = ["⭐", "📌", "🔥", "✅", "📝", "🛒", "💡", "📊", "🐾", "🍳"];

interface FavoriteStarButtonProps {
  favorites: FavoriteViewDTO[];
  /**
   * `sidebar` — wiersz na liście nawigacji · `topbar` — sama ikona w pasku mobilnym ·
   * `viewbar` — 043: wyeksponowany wiersz na SAMEJ GÓRZE sekcji ulubionych (desktop) ·
   * `viewbar-inline` — 045: sama ikona w PASKU BIEŻĄCEGO WIDOKU, czyli tam, gdzie
   * właściciel prosił o nią w 043; wtedy nie było wspólnego paska, więc się nie dało.
   */
  placement: "sidebar" | "topbar" | "viewbar" | "viewbar-inline";
}

/**
 * 042: gwiazdka „zapisz to miejsce" — jedyny punkt zapisu ulubionego widoku.
 *
 * Montowana RAZ w powłoce (pasek boczny na desktopie, górny na telefonie), a nie w nagłówku
 * każdego modułu — powłoka i tak zna bieżący adres, więc kilkanaście osobnych przycisków byłoby
 * kopiowaniem tego samego kodu (C-53).
 *
 * 043: wariant `viewbar` odpowiada na zgłoszenie „ulubionych nie ma na komputerze". Punkt zapisu
 * przestaje być ostatnią pozycją nawigacji, a staje się pierwszym elementem sekcji ulubionych —
 * z etykietą tekstową, nie samą ikoną. Wspólnego górnego paska na desktopie w Omnii nie ma
 * (`AppShell` renderuje `<main>{children}</main>`, nagłówek należy do modułu), a dokładanie go
 * oznaczałoby podwójne nagłówki w ~20 modułach — stąd góra nawigacji zamiast nagłówka strony.
 */
export function FavoriteStarButton({ favorites, placement }: FavoriteStarButtonProps) {
  const t = useTranslations("components.favorites.FavoriteStarButton");
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Pełny adres (ze `?query`) czytamy z przeglądarki, a NIE przez `useSearchParams`.
  // `useSearchParams` w komponencie powłoki wymusza granicę Suspense i potrafi zepchnąć
  // całą aplikację w renderowanie po stronie klienta — a powłoka opakowuje każdą stronę.
  //
  // 042/T-22: stan z efektu służy WYŁĄCZNIE do wyglądu (gwiazdka pełna/pusta). Przycisk NIE jest
  // przez niego blokowany, bo `disabled={!fullPath}` sprawiało, że przy pierwszym renderze — i przy
  // każdym ponownym zamontowaniu drzewa — gwiazdka była nieklikalna. Weryfikacja E2E wielokrotnie
  // trafiała wtedy na `<button disabled>`. Adres do zapisu wyliczamy synchronicznie w momencie
  // kliknięcia (`currentPath()`), więc poprawność nie zależy od tego, czy efekt zdążył się wykonać.
  const [fullPath, setFullPath] = useState<string | null>(null);
  useEffect(() => {
    setFullPath(normalizeFavoritePath(window.location.pathname + window.location.search));
  }, [pathname]);

  /** Bieżący adres liczony na żądanie — jedyne źródło prawdy przy zapisie/usuwaniu. */
  function currentPath(): string | null {
    if (typeof window === "undefined") return null;
    return normalizeFavoritePath(window.location.pathname + window.location.search);
  }

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState(DEFAULT_FAVORITE_ICON);
  const [color, setColor] = useState<string | null>(FAVORITE_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const saved = fullPath ? favorites.find((f) => f.path === fullPath) ?? null : null;
  const isSaved = !!saved;

  // Zamykanie: Esc (C-31) oraz klik poza popoverem.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    }
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.select(), 20); }, [open]);

  function handleClick() {
    const path = currentPath();
    if (!path) return;
    setError(null);
    // Stan „zapisane" liczymy tu ponownie z aktualnego adresu, a nie z `isSaved` — to ostatnie
    // pochodzi z efektu i przy świeżym montowaniu może być jeszcze nieustawione.
    const alreadySaved = favorites.some((f) => f.path === path);

    if (alreadySaved) {
      startTransition(async () => {
        await removeFavoriteViewByPath(path);
        router.refresh();
      });
      return;
    }

    const activeModule = MODULES.find((m) => (m.exact ? pathname === m.href : pathname.startsWith(m.href)));
    setLabel(suggestFavoriteLabel(path, activeModule?.label));
    setIcon(DEFAULT_FAVORITE_ICON);
    setColor(activeModule?.color && (FAVORITE_COLORS as readonly string[]).includes(activeModule.color)
      ? activeModule.color
      : FAVORITE_COLORS[0]);
    setOpen(true);
  }

  function handleSave() {
    const path = currentPath();
    if (!path) return;
    startTransition(async () => {
      try {
        await addFavoriteView({ label, path, icon, color });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać widoku");
      }
    });
  }

  const title = isSaved ? "Usuń to miejsce z ulubionych" : "Zapisz to miejsce w ulubionych";
  // 043/AC-2: w wariancie `viewbar` etykieta mówi wprost, co przycisk zrobi z BIEŻĄCYM widokiem —
  // „Dodaj do ulubionych" nie niosło informacji, że chodzi o miejsce, w którym właśnie jesteś.
  const viewbarLabel = isSaved ? "Zapisano — kliknij, by usunąć" : "Zapisz ten widok";

  const triggerClassName =
    placement === "sidebar"
      ? "flex items-center gap-3 px-4 py-2 mx-2 rounded text-sm w-[calc(100%-1rem)] focus:outline-none"
      : placement === "viewbar"
        ? "flex items-center gap-2 px-4 py-2 mx-2 rounded text-xs w-[calc(100%-1rem)] focus:outline-none"
        : "flex items-center justify-center rounded focus:outline-none";

  const trigger = (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={title}
      aria-label={title}
      aria-pressed={isSaved}
      className={triggerClassName}
      style={{
        color: isSaved ? "var(--accent-amber)" : "var(--text-secondary)",
        background: placement === "viewbar" ? "var(--bg-elevated)" : "transparent",
        border: placement === "viewbar" ? "1px solid var(--border)" : "none",
        cursor: "pointer",
        fontWeight: placement === "viewbar" ? 600 : undefined,
        // Cel dotyku ≥32 px (C-31).
        ...(placement === "topbar" || placement === "viewbar-inline" ? { width: 32, height: 32 } : null),
      }}
    >
      <Star size={placement === "viewbar" ? 14 : 18} fill={isSaved ? "var(--accent-amber)" : "none"} style={{ flexShrink: 0 }} />
      {placement === "sidebar" && <span>{isSaved ? "W ulubionych" : "Dodaj do ulubionych"}</span>}
      {placement === "viewbar" && <span className="truncate">{viewbarLabel}</span>}
    </button>
  );

  return (
    <div style={{ position: "relative" }}>
      {trigger}

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Zapisz widok w ulubionych"
          style={{
            position: "absolute",
            zIndex: 60,
            width: 268,
            // `sidebar` siedzi na dole paska → popover otwiera się w GÓRĘ; `viewbar` jest na
            // samej górze nawigacji, więc musi otwierać się w DÓŁ, inaczej wyjechałby poza ekran.
            // `viewbar-inline` siedzi po prawej stronie paska widoku, więc popover
            // musi być kotwiczony do prawej krawędzi — inaczej wyjeżdża poza ekran.
            ...(placement === "sidebar"
              ? { bottom: "100%", left: 8, marginBottom: 6 }
              : placement === "viewbar"
                ? { top: "100%", left: 8, marginTop: 6 }
                : { top: "100%", right: 0, marginTop: 6 }),
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 10px)",
            padding: 12,
            boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Zapisz widok</span>
            <button onClick={() => setOpen(false)} aria-label="Zamknij" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              <X size={13} />
            </button>
          </div>

          <input
            ref={inputRef}
            value={label}
            maxLength={MAX_FAVORITE_LABEL_LENGTH}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            placeholder="Nazwa widoku…"
            className="w-full text-sm focus:outline-none"
            style={{
              background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6,
              padding: "6px 8px", color: "var(--text-primary)", marginBottom: 8,
            }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {ICON_CHOICES.map((e) => (
              <button
                key={e}
                onClick={() => setIcon(e)}
                aria-label={`Ikona ${e}`}
                style={{
                  width: 26, height: 26, borderRadius: 6, fontSize: 14, cursor: "pointer",
                  background: icon === e ? "var(--bg-hover)" : "transparent",
                  border: `1px solid ${icon === e ? "var(--accent-blue)" : "var(--border)"}`,
                }}
              >
                {e}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {FAVORITE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Kolor ${c}`}
                style={{
                  width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer",
                  border: color === c ? "2px solid var(--text-primary)" : "1px solid var(--border)",
                }}
              />
            ))}
          </div>

          {error && (
            <p style={{ fontSize: 11, color: "var(--accent-red)", margin: "0 0 8px" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-2.5 py-1.5 rounded"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-xs px-2.5 py-1.5 rounded"
              style={{
                background: "var(--accent-blue)", color: "var(--on-accent)", fontWeight: 600,
                border: "none", cursor: "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              Zapisz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
