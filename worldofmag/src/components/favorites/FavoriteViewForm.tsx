"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
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

/**
 * 087 (AC-18): OPERACJA NA BIEŻĄCYM WIDOKU — wyjęta z gwiazdki, żeby zmieściła się w JEDNYM dialogu.
 *
 * Do 087 były dwa wejścia do ulubionych: gwiazdka („zapisz to miejsce", z własnym okienkiem)
 * i osobny przycisk otwierający listę. Właściciel poprosił, żeby klik w gwiazdkę otwierał TEN dialog
 * co lista, „tylko żeby w nim była także możliwość dodania/usunięcia z ulubionych bieżącego widoku".
 * Formularz musiał więc przenieść się tam, gdzie lista — a że jest to ten sam formularz, co dotąd,
 * przenosimy go, zamiast pisać drugi (C-53).
 *
 * Adres liczymy z `window.location` w momencie użycia, a nie przez `useSearchParams` — ten ostatni
 * w komponencie powłoki wymusza granicę `Suspense` i potrafi zepchnąć aplikację w renderowanie po
 * stronie klienta (lekcja z 042).
 */
export function FavoriteViewForm({
  favorites,
  onDone,
}: {
  favorites: FavoriteViewDTO[];
  /** Wołane po udanym zapisie/usunięciu — dialog sam decyduje, czy się zamknąć. */
  onDone: () => void;
}) {
  const t = useTranslations("components.favorites.FavoriteViewForm");
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullPath, setFullPath] = useState<string | null>(null);
  const [rozwiniete, setRozwiniete] = useState(false);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState(DEFAULT_FAVORITE_ICON);
  const [color, setColor] = useState<string | null>(FAVORITE_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullPath(normalizeFavoritePath(window.location.pathname + window.location.search));
  }, [pathname]);

  const zapisany = fullPath ? favorites.find((f) => f.path === fullPath) ?? null : null;

  useEffect(() => {
    if (rozwiniete) setTimeout(() => inputRef.current?.select(), 20);
  }, [rozwiniete]);

  function rozwin() {
    if (!fullPath) return;
    const modul = MODULES.find((m) => (m.exact ? pathname === m.href : pathname.startsWith(m.href)));
    setLabel(suggestFavoriteLabel(fullPath, modul?.label));
    setIcon(DEFAULT_FAVORITE_ICON);
    setColor(
      modul?.color && (FAVORITE_COLORS as readonly string[]).includes(modul.color) ? modul.color : FAVORITE_COLORS[0],
    );
    setError(null);
    setRozwiniete(true);
  }

  function zapisz() {
    if (!fullPath) return;
    startTransition(async () => {
      try {
        await addFavoriteView({ label, path: fullPath, icon, color });
        setRozwiniete(false);
        router.refresh();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać widoku");
      }
    });
  }

  function usun() {
    if (!fullPath) return;
    startTransition(async () => {
      await removeFavoriteViewByPath(fullPath);
      router.refresh();
      onDone();
    });
  }

  const wiersz: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text-primary)",
    textAlign: "left",
  };

  if (zapisany) {
    return (
      <button type="button" onClick={usun} disabled={isPending} style={wiersz}>
        <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{zapisany.icon}</span>
        <span className="flex-1 truncate">{t("usunBiezacyWidok")}</span>
      </button>
    );
  }

  if (!rozwiniete) {
    return (
      <button type="button" onClick={rozwin} disabled={!fullPath} style={wiersz}>
        <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>＋</span>
        <span className="flex-1 truncate">{t("dodajBiezacyWidok")}</span>
      </button>
    );
  }

  return (
    <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        ref={inputRef}
        value={label}
        maxLength={MAX_FAVORITE_LABEL_LENGTH}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") zapisz();
          if (e.key === "Escape") { e.stopPropagation(); setRozwiniete(false); }
        }}
        placeholder="Nazwa widoku…"
        className="w-full text-sm focus:outline-none"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 8px",
          color: "var(--text-primary)",
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {ICON_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
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

      <div style={{ display: "flex", gap: 6 }}>
        {FAVORITE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Kolor ${c}`}
            style={{
              width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer",
              border: color === c ? "2px solid var(--text-primary)" : "1px solid var(--border)",
            }}
          />
        ))}
      </div>

      {error && <p style={{ fontSize: 11, color: "var(--accent-red)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setRozwiniete(false)}
          className="text-xs px-2.5 py-1.5 rounded"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={zapisz}
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
  );
}
