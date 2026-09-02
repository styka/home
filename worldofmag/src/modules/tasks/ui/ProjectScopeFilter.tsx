"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderTree, Check, Bookmark, Loader2, Trash2 } from "lucide-react";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { createProjectGroup, updateProjectGroup, deleteProjectGroup } from "../actions/projectGroups";
import type { TaskProject } from "@/types";

/**
 * 080 (Z3): FILTR PROJEKTÓW — wybór wielu naraz, z możliwością zapisania zestawu.
 *
 * Propozycja właściciela brzmiała: „może wystarczyłby wspólny widok, po prostu w filtrze
 * wybierałoby się projekty, których zadania mają się pojawiać (…) jak zaznaczę 3 projekty z 5,
 * to mogę to zapisać jako filtr predefiniowany i w przyszłości będę mógł go wybrać".
 *
 * Dwie decyzje, które z tego wynikają:
 *
 *  1. **Zaznaczenie zawęża listę PO STRONIE KLIENTA.** Widoki zbiorcze i tak ładują wszystkie
 *     zadania użytkownika, więc nie ma po co pytać serwera. Ważniejsze: utrata parametru z adresu
 *     pokazuje wtedy WSZYSTKIE projekty, a nie żaden. To jest reguła, przez którą powstał cały
 *     ten zestaw zmian — zakres nie może degradować do zera zasobów (patrz TasksRouteView).
 *  2. **Zapisany zestaw to zwykła grupa projektów**, ten sam byt, który istnieje od dawna.
 *     Dokładanie drugiego nośnika „filtrów predefiniowanych" obok grup dałoby dwie listy tego
 *     samego, rozjeżdżające się przy pierwszej edycji.
 *
 * 122: ten dropdown jest JEDYNYM mechanizmem zakresu projektów. W widoku zapisanego zestawu
 * (prop `zestaw`) pokazuje i edytuje zakres ORAZ metadane zestawu (nazwa/emoji/kolor, usunięcie)
 * — pasek chipów „Projekty: …" i osobny edytor grup w nawigacji bocznej przestały istnieć.
 * Edycja zakresu to ZMIANA OCZEKUJĄCA zapisywana przyciskiem: widok zestawu ładuje z serwera
 * wyłącznie zadania projektów grupy, więc podgląd „na żywo" po dodaniu projektu nie miałby danych.
 */

/** Metadane zestawu w trybie edycji (widok /tasks/zestaw/<id>). */
export type ZestawWFiltrze = {
  id: string;
  name: string;
  emoji: string;
  color: string | null;
  projectIds: string[];
};

// Presety koloru zestawu (kropka-znacznik przy projekcie w nawigacji). Tokeny motywu (C-30).
const KOLORY_ZESTAWU = [
  "var(--accent-blue)",
  "var(--accent-green)",
  "var(--accent-amber)",
  "var(--accent-red)",
  "var(--accent-purple)",
] as const;

/** T-10: sygnał dla nawigacji bocznej, że lista zestawów się zmieniła. `revalidatePath` odświeża
    drzewo RSC, ale `TasksSideNav` trzyma grupy w stanie klienckim ładowanym przy montażu — bez
    tego zdarzenia usunięty zestaw zostawał w sidebarze jako link do 404. */
export const ZDARZENIE_ZMIANY_ZESTAWOW = "tasks:groups-changed";

function ogloszZmianeZestawow() {
  window.dispatchEvent(new Event(ZDARZENIE_ZMIANY_ZESTAWOW));
}

export function ProjectScopeFilter({
  allProjects,
  selected = [],
  onChange,
  zestaw,
}: {
  allProjects: TaskProject[];
  /** Tryb ad hoc (widoki zbiorcze): kontrolowany wybór. Ignorowane w trybie zestawu. */
  selected?: string[];
  onChange?: (next: string[]) => void;
  /** Tryb zestawu: edycja zakresu i metadanych zapisanego zestawu. */
  zestaw?: ZestawWFiltrze;
}) {
  const t = useTranslations("modules.tasks.ProjectScopeFilter");
  const router = useRouter();
  const confirmDialog = useConfirm();
  const kotwica = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [nazwa, setNazwa] = useState("");
  const [zapisywanie, startZapis] = useTransition();
  // T-12: treść błędu ostatniej akcji trybu zestawu — panel nie może milczeć przy niepowodzeniu.
  const [blad, setBlad] = useState<string | null>(null);

  // ——— Tryb zestawu: roboczy stan (zmiana oczekująca do zapisu) ———
  const [roboczy, setRoboczy] = useState(() =>
    zestaw ? { id: zestaw.id, name: zestaw.name, emoji: zestaw.emoji, color: zestaw.color, projekty: [...zestaw.projectIds] } : null
  );
  // Zmiana zestawu (nawigacja między zestawami) resetuje roboczy stan — wzorzec „reset przy zmianie
  // klucza w renderze" zamiast efektu: nie ma klatki ze stanem poprzedniego zestawu.
  if (zestaw && roboczy?.id !== zestaw.id) {
    setRoboczy({ id: zestaw.id, name: zestaw.name, emoji: zestaw.emoji, color: zestaw.color, projekty: [...zestaw.projectIds] });
  }

  const trybZestawu = !!zestaw && !!roboczy;
  const wybrane = new Set(trybZestawu ? roboczy!.projekty : selected);

  const zmieniony =
    trybZestawu &&
    (roboczy!.name !== zestaw!.name ||
      roboczy!.emoji !== zestaw!.emoji ||
      roboczy!.color !== zestaw!.color ||
      roboczy!.projekty.length !== zestaw!.projectIds.length ||
      roboczy!.projekty.some((id) => !zestaw!.projectIds.includes(id)));

  function przelacz(id: string) {
    if (trybZestawu) {
      setBlad(null);
      setRoboczy((p) =>
        p ? { ...p, projekty: p.projekty.includes(id) ? p.projekty.filter((x) => x !== id) : [...p.projekty, id] } : p
      );
      return;
    }
    const next = wybrane.has(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange?.(next);
  }

  function zapiszZestaw() {
    const tytul = nazwa.trim();
    if (!tytul || selected.length === 0) return;
    startZapis(async () => {
      try {
        const grupa = await createProjectGroup({ name: tytul, projectIds: selected });
        ogloszZmianeZestawow();
        setOpen(false);
        setNazwa("");
        router.push(`/tasks/zestaw/${grupa.id}`);
      } catch {
        /* nazwa zajęta albo brak dostępu — zostawiamy panel otwarty, żeby dało się poprawić */
      }
    });
  }

  // ——— Akcje trybu zestawu ———

  function zapiszZmiany() {
    if (!trybZestawu || !zmieniony || roboczy!.projekty.length === 0) return;
    const r = roboczy!;
    startZapis(async () => {
      try {
        // T-11: serwer normalizuje wartości (trim, pusty emoji → „🗂") — roboczy stan przyjmuje
        // ZAPISANY rekord, inaczej „Zapisz zmiany" zostawałby aktywny mimo udanego zapisu.
        const zapisany = await updateProjectGroup(r.id, {
          name: r.name.trim() || zestaw!.name,
          emoji: r.emoji,
          color: r.color,
          projectIds: r.projekty,
        });
        setRoboczy({ id: zapisany.id, name: zapisany.name, emoji: zapisany.emoji, color: zapisany.color, projekty: [...zapisany.projectIds] });
        ogloszZmianeZestawow();
        setBlad(null);
        setOpen(false);
      } catch (err) {
        setBlad(err instanceof Error ? err.message : t("bladZapisuZestawu"));
      }
    });
  }

  function zapiszJakoNowy() {
    if (!trybZestawu || roboczy!.projekty.length === 0) return;
    const r = roboczy!;
    startZapis(async () => {
      try {
        const grupa = await createProjectGroup({
          name: (r.name.trim() || zestaw!.name).slice(0, 80),
          emoji: r.emoji,
          color: r.color,
          projectIds: r.projekty,
        });
        ogloszZmianeZestawow();
        setBlad(null);
        setOpen(false);
        router.push(`/tasks/zestaw/${grupa.id}`);
      } catch (err) {
        setBlad(err instanceof Error ? err.message : t("bladZapisuZestawu"));
      }
    });
  }

  async function usunZestaw() {
    if (!trybZestawu) return;
    if (!(await confirmDialog({ title: t("usunZestawPytanie", { nazwa: zestaw!.name }), destructive: true }))) return;
    startZapis(async () => {
      try {
        await deleteProjectGroup(zestaw!.id);
        ogloszZmianeZestawow();
        setBlad(null);
        setOpen(false);
        router.push("/tasks/all");
      } catch (err) {
        setBlad(err instanceof Error ? err.message : t("bladZapisuZestawu"));
      }
    });
  }

  // 100: stan nie może mieszkać wyłącznie w zamkniętej warstwie — kotwica nazywa zakres.
  const etykieta = trybZestawu
    ? t("zakresZestawu", { ile: roboczy!.projekty.length, wszystkie: allProjects.length })
    : selected.length === 0
      ? t("wszystkieProjekty")
      : t("wybraneProjekty", { ile: selected.length });

  const podswietlona = trybZestawu || selected.length > 0;

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
        title={trybZestawu ? t("zakresIUstawieniaZestawu") : t("filtrProjektow")}
        aria-label={trybZestawu ? t("zakresIUstawieniaZestawu") : t("filtrProjektow")}
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
        ariaLabel={t("filtrProjektow")}
        style={{ padding: 6 }}
      >
        <div className="max-h-64 overflow-y-auto">
          {allProjects.map((p) => {
            const zaznaczony = wybrane.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => przelacz(p.id)}
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
                <span className="shrink-0">{p.isInbox ? "📥" : p.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
              </button>
            );
          })}
        </div>

        {trybZestawu ? (
          <div className="mt-1 border-t border-[var(--border)] pt-2">
            {/* Metadane zestawu: ikona + nazwa (kontrolki przeniesione 1:1 z dawnego edytora grup). */}
            <div className="flex items-center gap-1 px-1">
              <input
                value={roboczy!.emoji}
                onChange={(e) => { setBlad(null); setRoboczy((p) => (p ? { ...p, emoji: e.target.value.slice(0, 2) } : p)); }}
                className="w-7 shrink-0 rounded bg-transparent text-center text-sm focus:outline-none"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                aria-label={t("ikonaZestawu")}
              />
              <input
                value={roboczy!.name}
                onChange={(e) => { setBlad(null); setRoboczy((p) => (p ? { ...p, name: e.target.value } : p)); }}
                onKeyDown={(e) => { if (e.key === "Enter") zapiszZmiany(); }}
                placeholder={t("nazwaZestawu")}
                aria-label={t("nazwaZestawu")}
                className="min-w-0 flex-1 rounded border bg-transparent px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Kolor zestawu (kropka-znacznik w nawigacji) */}
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
              {KOLORY_ZESTAWU.map((c) => (
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
                  title={t("kolorZestawu")}
                />
              ))}
            </div>

            {/* Zakres nie może zdegradować do zera (080) — pusty wybór nie da się zapisać. */}
            {roboczy!.projekty.length === 0 && (
              <div className="mt-2 px-1 text-xs" style={{ color: "var(--accent-red)" }}>{t("wybierzProjekt")}</div>
            )}

            {/* T-12: niepowodzenie akcji nie może być nieme — panel pokazuje treść błędu. */}
            {blad && (
              <div className="mt-2 px-1 text-xs" role="alert" style={{ color: "var(--accent-red)" }}>{blad}</div>
            )}

            <div className="mt-2 flex items-center gap-1 px-1 pb-1">
              <button
                onClick={zapiszZmiany}
                disabled={!zmieniony || roboczy!.projekty.length === 0 || zapisywanie}
                className="flex items-center gap-1 rounded px-2 py-2 text-xs disabled:opacity-40 focus:outline-none"
                style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
              >
                {zapisywanie ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {t("zapiszZmiany")}
              </button>
              <button
                onClick={zapiszJakoNowy}
                disabled={roboczy!.projekty.length === 0 || zapisywanie}
                className="flex items-center gap-1 rounded px-2 py-2 text-xs disabled:opacity-40 focus:outline-none"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                title={t("zapiszJakoNowy")}
              >
                <Bookmark size={13} />
                {t("jakoNowy")}
              </button>
              <button
                onClick={usunZestaw}
                disabled={zapisywanie}
                className="ml-auto flex items-center rounded p-2 focus:outline-none"
                style={{ color: "var(--accent-red)" }}
                title={t("usunZestaw")}
                aria-label={t("usunZestaw")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 border-t border-[var(--border)] pt-2">
            {selected.length > 0 && (
              <button
                onClick={() => onChange?.([])}
                className="mb-2 w-full rounded px-2 py-2 text-left text-xs focus:outline-none"
                style={{ color: "var(--text-muted)" }}
              >
                {t("wyczyscWybor")}
              </button>
            )}

            {/* Zapisanie wyboru to ta „predefiniowana" część prośby właściciela. Pole pokazuje się
                dopiero, gdy jest co zapisywać — pusty formularz w rozwijanym filtrze to szum. */}
            {selected.length > 0 && (
              <div className="flex items-center gap-1">
                <input
                  value={nazwa}
                  onChange={(e) => setNazwa(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") zapiszZestaw(); }}
                  placeholder={t("nazwaZestawu")}
                  aria-label={t("nazwaZestawu")}
                  className="min-w-0 flex-1 rounded border bg-transparent px-2 py-2 text-xs focus:outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={zapiszZestaw}
                  disabled={!nazwa.trim() || zapisywanie}
                  className="flex shrink-0 items-center gap-1 rounded px-2 py-2 text-xs disabled:opacity-40 focus:outline-none"
                  style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
                  title={t("zapiszJakoZestaw")}
                >
                  {zapisywanie ? <Loader2 size={13} className="animate-spin" /> : <Bookmark size={13} />}
                </button>
              </div>
            )}
          </div>
        )}
      </AnchoredLayer>
    </>
  );
}
