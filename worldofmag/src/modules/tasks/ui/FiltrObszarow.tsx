"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderTree, Check, Loader2, Trash2, Plus } from "lucide-react";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  createObszarProjektow,
  updateObszarProjektow,
  deleteObszarProjektow,
  ustawProjektyObszaru,
} from "../actions/obszaryProjektow";
import { splaszczDrzewo } from "../lib/poddrzewoObszarow";
import type { ObszarProjektow, TaskProject } from "@/types";

/**
 * 125: OBSZARY-KATEGORIE — jeden mechanizm zamiast grup projektów (następca ProjectScopeFilter
 * ze 122). Dwa tryby na tym samym dropdownie:
 *
 *  - **Filtr** (widoki zbiorcze): wybór JEDNOWARTOŚCIOWY obszaru; wynik obejmuje zadania całego
 *    PODDRZEWA (obszar + pod-obszary aż do liści — decyzja właściciela ze `/specify`). Pozycja
 *    „Wszystkie obszary" zdejmuje filtr — zakres nigdy nie degraduje do zera (reguła 080).
 *  - **Zarządzanie** (widok /tasks/obszar/<id>, prop `obszar`): checkboxy projektów przypisanych
 *    BEZPOŚREDNIO do tego obszaru (model 1:N — zaznaczenie kradnie projekt innemu obszarowi),
 *    nazwa/emoji/kolor, dodanie pod-obszaru i usunięcie. Zmiany zapisuje przycisk (widok ładuje
 *    z serwera tylko zadania poddrzewa, więc podgląd „na żywo" nie miałby danych — lekcja 122).
 *
 * Po każdej mutacji leci zdarzenie okna `tasks:areas-changed` — nawigacja boczna trzyma obszary
 * w stanie klienckim, którego `revalidatePath` nie odświeża (lekcja 122/T-10).
 */

export const ZDARZENIE_ZMIANY_OBSZAROW = "tasks:areas-changed";

function ogloszZmianeObszarow() {
  window.dispatchEvent(new Event(ZDARZENIE_ZMIANY_OBSZAROW));
}

// Presety koloru obszaru (kropka-znacznik w nawigacji). Tokeny motywu (C-30).
const KOLORY_OBSZARU = [
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-amber)",
  "var(--accent-red)",
  "var(--accent-purple)",
] as const;

export function FiltrObszarow({
  obszary,
  wybrany = null,
  onChange,
  obszar,
  allProjects = [],
}: {
  /** Pełne drzewo obszarów przestrzeni (płaska lista z parentId). */
  obszary: ObszarProjektow[];
  /** Tryb filtra: wybrany obszar (null = wszystkie). Ignorowane w trybie zarządzania. */
  wybrany?: string | null;
  onChange?: (next: string | null) => void;
  /** Tryb zarządzania: edytowany obszar (widok /tasks/obszar/<id>). */
  obszar?: ObszarProjektow;
  /** Tryb zarządzania: wszystkie projekty (checkboxy przypisania; `areaId` mówi, czyj kto). */
  allProjects?: TaskProject[];
}) {
  const t = useTranslations("modules.tasks.FiltrObszarow");
  const router = useRouter();
  const confirmDialog = useConfirm();
  const kotwica = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [zapisywanie, startZapis] = useTransition();
  const [blad, setBlad] = useState<string | null>(null);
  const [nazwaPodobszaru, setNazwaPodobszaru] = useState("");

  // ——— Tryb zarządzania: roboczy stan (zmiana oczekująca do zapisu) ———
  const przypisane = () => allProjects.filter((p) => p.areaId === obszar!.id).map((p) => p.id);
  const [roboczy, setRoboczy] = useState(() =>
    obszar ? { id: obszar.id, name: obszar.name, emoji: obszar.emoji, color: obszar.color, projekty: przypisane() } : null
  );
  // Reset przy zmianie obszaru — wzorzec „reset w renderze" (bez klatki poprzedniego stanu).
  if (obszar && roboczy?.id !== obszar.id) {
    setRoboczy({ id: obszar.id, name: obszar.name, emoji: obszar.emoji, color: obszar.color, projekty: przypisane() });
  }

  const trybZarzadzania = !!obszar && !!roboczy;
  const drzewo = splaszczDrzewo(obszary);

  const zmieniony =
    trybZarzadzania &&
    (roboczy!.name !== obszar!.name ||
      roboczy!.emoji !== obszar!.emoji ||
      roboczy!.color !== obszar!.color ||
      roboczy!.projekty.length !== przypisane().length ||
      roboczy!.projekty.some((id) => !przypisane().includes(id)));

  function zapiszZmiany() {
    if (!trybZarzadzania || !zmieniony) return;
    const r = roboczy!;
    startZapis(async () => {
      try {
        const zapisany = await updateObszarProjektow(r.id, {
          name: r.name.trim() || obszar!.name,
          emoji: r.emoji,
          color: r.color,
        });
        await ustawProjektyObszaru(r.id, r.projekty);
        setRoboczy((p) => (p ? { ...p, name: zapisany.name, emoji: zapisany.emoji, color: zapisany.color } : p));
        ogloszZmianeObszarow();
        setBlad(null);
        setOpen(false);
      } catch (err) {
        setBlad(err instanceof Error ? err.message : t("bladZapisu"));
      }
    });
  }

  function dodajPodobszar() {
    if (!trybZarzadzania) return;
    const nazwa = nazwaPodobszaru.trim();
    if (!nazwa) return;
    startZapis(async () => {
      try {
        const nowy = await createObszarProjektow({ name: nazwa, parentId: obszar!.id });
        ogloszZmianeObszarow();
        setNazwaPodobszaru("");
        setBlad(null);
        setOpen(false);
        router.push(`/tasks/obszar/${nowy.id}`);
      } catch (err) {
        setBlad(err instanceof Error ? err.message : t("bladZapisu"));
      }
    });
  }

  async function usunObszar() {
    if (!trybZarzadzania) return;
    if (!(await confirmDialog({ title: t("usunObszarPytanie", { nazwa: obszar!.name }), destructive: true }))) return;
    startZapis(async () => {
      try {
        await deleteObszarProjektow(obszar!.id);
        ogloszZmianeObszarow();
        setBlad(null);
        setOpen(false);
        router.push("/tasks/all");
      } catch (err) {
        setBlad(err instanceof Error ? err.message : t("bladZapisu"));
      }
    });
  }

  const wybranyObszar = wybrany ? obszary.find((o) => o.id === wybrany) ?? null : null;
  const etykieta = trybZarzadzania
    ? t("projektyObszaru", { ile: roboczy!.projekty.length })
    : wybranyObszar
      ? `${wybranyObszar.emoji} ${wybranyObszar.name}`
      : t("wszystkieObszary");
  const podswietlona = trybZarzadzania || !!wybranyObszar;

  return (
    <>
      <button
        ref={kotwica}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs focus:outline-none"
        style={{
          color: podswietlona ? "var(--accent-blue)" : "var(--text-muted)",
          backgroundColor: podswietlona ? "var(--bg-hover)" : "transparent",
        }}
        title={trybZarzadzania ? t("ustawieniaObszaru") : t("filtrObszarow")}
        aria-label={trybZarzadzania ? t("ustawieniaObszaru") : t("filtrObszarow")}
        aria-expanded={open}
      >
        <FolderTree size={14} />
        <span className="hidden sm:inline">{etykieta}</span>
      </button>

      <AnchoredLayer
        anchorRef={kotwica}
        open={open}
        onClose={() => setOpen(false)}
        side="dol"
        align="start"
        width={280}
        ariaLabel={trybZarzadzania ? t("ustawieniaObszaru") : t("filtrObszarow")}
        style={{ padding: 6 }}
      >
        {trybZarzadzania ? (
          <>
            {/* Metadane obszaru: ikona + nazwa (wzorzec 122). */}
            <div className="flex items-center gap-1 px-1">
              <input
                value={roboczy!.emoji}
                onChange={(e) => { setBlad(null); setRoboczy((p) => (p ? { ...p, emoji: e.target.value.slice(0, 2) } : p)); }}
                className="w-7 shrink-0 rounded bg-transparent text-center text-sm focus:outline-none"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                aria-label={t("ikonaObszaru")}
              />
              <input
                value={roboczy!.name}
                onChange={(e) => { setBlad(null); setRoboczy((p) => (p ? { ...p, name: e.target.value } : p)); }}
                onKeyDown={(e) => { if (e.key === "Enter") zapiszZmiany(); }}
                placeholder={t("nazwaObszaru")}
                aria-label={t("nazwaObszaru")}
                className="min-w-0 flex-1 rounded border bg-transparent px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Kolor obszaru (kropka-znacznik w nawigacji) */}
            <div className="mt-2 flex items-center gap-1.5 px-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t("kolor")}</span>
              <button
                onClick={() => setRoboczy((p) => (p ? { ...p, color: null } : p))}
                className="flex items-center justify-center rounded-full focus:outline-none"
                style={{ width: 16, height: 16, border: "1px solid var(--border)", color: "var(--text-muted)" }}
                title={t("bezKoloru")}
              >
                {roboczy!.color === null && <Check size={9} />}
              </button>
              {KOLORY_OBSZARU.map((c) => (
                <button
                  key={c}
                  onClick={() => setRoboczy((p) => (p ? { ...p, color: c } : p))}
                  className="rounded-full focus:outline-none"
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: c,
                    outline: roboczy!.color === c ? "2px solid var(--text-primary)" : "none",
                    outlineOffset: 1,
                  }}
                  title={t("kolorObszaru")}
                />
              ))}
            </div>

            {/* Projekty przypisane BEZPOŚREDNIO do tego obszaru (1:N — zaznaczenie przenosi projekt tu). */}
            <div className="mt-2 max-h-52 overflow-y-auto border-t border-[var(--border)] pt-1">
              {allProjects.filter((p) => !p.isInbox).map((p) => {
                const zaznaczony = roboczy!.projekty.includes(p.id);
                const gdzieIndziej = !zaznaczony && p.areaId && p.areaId !== obszar!.id
                  ? obszary.find((o) => o.id === p.areaId)
                  : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setBlad(null);
                      setRoboczy((prev) =>
                        prev
                          ? { ...prev, projekty: zaznaczony ? prev.projekty.filter((x) => x !== p.id) : [...prev.projekty, p.id] }
                          : prev
                      );
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-3 text-left text-sm focus:outline-none"
                    style={{ color: "var(--text-primary)" }}
                    role="menuitemcheckbox"
                    aria-checked={zaznaczony}
                  >
                    <span
                      className="flex shrink-0 items-center justify-center rounded"
                      style={{
                        width: 18,
                        height: 18,
                        border: `2px solid ${zaznaczony ? "var(--accent-blue)" : "var(--border)"}`,
                        backgroundColor: zaznaczony ? "var(--accent-blue)" : "transparent",
                      }}
                    >
                      {zaznaczony && <Check size={12} color="var(--on-accent)" />}
                    </span>
                    <span className="shrink-0">{p.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {gdzieIndziej && (
                      <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }} title={t("wInnymObszarze", { nazwa: gdzieIndziej.name })}>
                        {gdzieIndziej.emoji}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Pod-obszar (drzewo — decyzja właściciela: obszary zagnieżdżają się do liści). */}
            <div className="mt-1 flex items-center gap-1 border-t border-[var(--border)] px-1 pt-2">
              <input
                value={nazwaPodobszaru}
                onChange={(e) => { setBlad(null); setNazwaPodobszaru(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter") dodajPodobszar(); }}
                placeholder={t("nazwaPodobszaru")}
                aria-label={t("nazwaPodobszaru")}
                className="min-w-0 flex-1 rounded border bg-transparent px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={dodajPodobszar}
                disabled={!nazwaPodobszaru.trim() || zapisywanie}
                className="flex shrink-0 items-center gap-1 rounded px-2 py-2 text-xs disabled:opacity-40 focus:outline-none"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                title={t("dodajPodobszar")}
                aria-label={t("dodajPodobszar")}
              >
                <Plus size={13} />
              </button>
            </div>

            {blad && (
              <div className="mt-2 px-1 text-xs" role="alert" style={{ color: "var(--accent-red)" }}>{blad}</div>
            )}

            <div className="mt-2 flex items-center gap-1 px-1 pb-1">
              <button
                onClick={zapiszZmiany}
                disabled={!zmieniony || zapisywanie}
                className="flex items-center gap-1 rounded px-2 py-2 text-xs disabled:opacity-40 focus:outline-none"
                style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
              >
                {zapisywanie ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {t("zapiszZmiany")}
              </button>
              <button
                onClick={usunObszar}
                disabled={zapisywanie}
                className="ml-auto flex items-center rounded p-2 focus:outline-none"
                style={{ color: "var(--accent-red)" }}
                title={t("usunObszar")}
                aria-label={t("usunObszar")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <button
              onClick={() => { onChange?.(null); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded px-2 py-3 text-left text-sm focus:outline-none"
              style={{ color: wybrany === null ? "var(--accent-blue)" : "var(--text-primary)" }}
              role="menuitemradio"
              aria-checked={wybrany === null}
            >
              {wybrany === null ? <Check size={14} className="shrink-0" /> : <span className="w-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{t("wszystkieObszary")}</span>
            </button>
            {drzewo.map((o) => {
              const zaznaczony = wybrany === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => { onChange?.(o.id); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-3 text-left text-sm focus:outline-none"
                  style={{ color: zaznaczony ? "var(--accent-blue)" : "var(--text-primary)", paddingLeft: 8 + o.glebokosc * 16 }}
                  role="menuitemradio"
                  aria-checked={zaznaczony}
                >
                  {zaznaczony ? <Check size={14} className="shrink-0" /> : <span className="w-3.5 shrink-0" />}
                  <span className="shrink-0">{o.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {(o.activeCount ?? 0) > 0 && (
                    <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>{o.activeCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </AnchoredLayer>
    </>
  );
}
