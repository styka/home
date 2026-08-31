"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, MoreVertical, Pencil, FolderPlus, FolderInput, Trash2 } from "lucide-react";
import { PrzelacznikSegmentowy } from "@/components/ui/nav/PrzelacznikSegmentowy";
import { Modal } from "@/components/ui/Modal";
import { splaszczDrzewo, idPoddrzewa, type ObszarZGlebokoscia } from "../lib/obszary";
import { createArea, renameArea, moveArea, deleteArea, type ObszarDTO } from "../actions/obszary";
import { ObszarySekcje } from "./ObszarySekcje";
import { ObszaryDrill } from "./ObszaryDrill";
import { ObszaryPanel } from "./ObszaryPanel";
import type { WariantObszarow } from "../lib/wariantObszarow";
import type { Task, ProjectStatusConfig } from "@/types";

/**
 * 117 (AC-3/AC-4/AC-5): widok „wg obszarów" — trzy przełączalne prezentacje JEDNEGO zbioru
 * zadań (lekcja 085: różni się wyłącznie render, nigdy dane): zwijane sekcje drzewa (domyślna),
 * drill-down (mobilna) i panel boczny z drzewem (desktop). Tu też mieszka całe zarządzanie
 * drzewem (nowy / zmiana nazwy / przeniesienie / usunięcie z wyborem trybu).
 */

export interface AkcjeObszaru {
  zmienNazwe: (obszar: ObszarDTO) => void;
  nowyPodobszar: (parentId: string | null) => void;
  przenies: (obszar: ObszarDTO) => void;
  usun: (obszar: ObszarDTO) => void;
}

export interface DaneObszarow {
  drzewo: ObszarZGlebokoscia<ObszarDTO>[];
  /** Zadania per obszar; klucz `null` = bez obszaru (także osierocone wskazania). */
  zadaniaWObszarze: Map<string | null, Task[]>;
  /** Liczba zadań w CAŁYM poddrzewie obszaru (kafle drill-down, drzewo panelu). */
  liczbaWPoddrzewie: Map<string, number>;
}

interface ObszaryWidokProps {
  obszary: ObszarDTO[];
  zadania: Task[];
  projectId: string;
  statusConfig: ProjectStatusConfig;
  wariant: WariantObszarow;
  onWariant: (w: WariantObszarow) => void;
  focusedTaskId: string | null;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
}

type Dialog =
  | { typ: "nowy"; parentId: string | null }
  | { typ: "zmiana"; obszar: ObszarDTO }
  | { typ: "przenies"; obszar: ObszarDTO }
  | { typ: "usun"; obszar: ObszarDTO }
  | null;

export function ObszaryWidok({ obszary, zadania, projectId, statusConfig, wariant, onWariant, focusedTaskId, onFocus, onOpen }: ObszaryWidokProps) {
  const t = useTranslations("modules.tasks.ObszaryWidok");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [nazwa, setNazwa] = useState("");
  const [celPrzeniesienia, setCelPrzeniesienia] = useState<string | "">("");
  const [pending, startTransition] = useTransition();

  const dane = useMemo<DaneObszarow>(() => {
    const drzewo = splaszczDrzewo(obszary);
    const znane = new Set(obszary.map((o) => o.id));
    const zadaniaWObszarze = new Map<string | null, Task[]>();
    for (const z of zadania) {
      const klucz = z.areaId !== null && z.areaId !== undefined && znane.has(z.areaId) ? z.areaId : null;
      const lista = zadaniaWObszarze.get(klucz) ?? [];
      lista.push(z);
      zadaniaWObszarze.set(klucz, lista);
    }
    // Liczność poddrzewa liczona od liści w górę: spłaszczenie ma rodzica przed dzieckiem,
    // więc przechodzimy od końca i dosypujemy do rodzica.
    const liczbaWPoddrzewie = new Map<string, number>();
    for (let i = drzewo.length - 1; i >= 0; i--) {
      const { obszar } = drzewo[i];
      const wlasne = zadaniaWObszarze.get(obszar.id)?.length ?? 0;
      const dzieci = obszary
        .filter((o) => o.parentId === obszar.id)
        .reduce((suma, o) => suma + (liczbaWPoddrzewie.get(o.id) ?? 0), 0);
      liczbaWPoddrzewie.set(obszar.id, wlasne + dzieci);
    }
    return { drzewo, zadaniaWObszarze, liczbaWPoddrzewie };
  }, [obszary, zadania]);

  const akcje: AkcjeObszaru = {
    zmienNazwe: (obszar) => { setNazwa(obszar.name); setDialog({ typ: "zmiana", obszar }); },
    nowyPodobszar: (parentId) => { setNazwa(""); setDialog({ typ: "nowy", parentId }); },
    przenies: (obszar) => { setCelPrzeniesienia(obszar.parentId ?? ""); setDialog({ typ: "przenies", obszar }); },
    usun: (obszar) => setDialog({ typ: "usun", obszar }),
  };

  function zapiszDialog() {
    if (!dialog) return;
    startTransition(async () => {
      try {
        if (dialog.typ === "nowy") {
          const n = nazwa.trim();
          if (!n) return;
          await createArea(projectId, n, dialog.parentId);
        } else if (dialog.typ === "zmiana") {
          const n = nazwa.trim();
          if (!n) return;
          await renameArea(dialog.obszar.id, n);
        } else if (dialog.typ === "przenies") {
          await moveArea(dialog.obszar.id, { parentId: celPrzeniesienia || null });
        }
        setDialog(null);
      } catch {
        // Walidacja serwera (cykl, pusty tekst) — dialog zostaje otwarty, użytkownik poprawia.
      }
    });
  }

  function usunObszar(tryb: "scal" | "poddrzewo") {
    if (dialog?.typ !== "usun") return;
    const obszar = dialog.obszar;
    startTransition(async () => {
      try {
        await deleteArea(obszar.id, tryb);
        setDialog(null);
      } catch {
        // Błąd serwera — dialog zostaje otwarty, użytkownik może ponowić (recenzja, ust. 4).
      }
    });
  }

  // Cele przeniesienia: całe drzewo bez poddrzewa przenoszonego (przeniesienie pod potomka = cykl).
  const celePrzeniesienia = useMemo(() => {
    if (dialog?.typ !== "przenies") return [];
    const zakazane = idPoddrzewa(obszary, dialog.obszar.id);
    return dane.drzewo.filter((w) => !zakazane.has(w.obszar.id));
  }, [dialog, obszary, dane.drzewo]);

  const liczbaUsuwanych = dialog?.typ === "usun" ? idPoddrzewa(obszary, dialog.obszar.id).size : 0;

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <PrzelacznikSegmentowy
          pozycje={[
            { id: "sekcje", etykieta: t("wariantSekcje") },
            { id: "drill", etykieta: t("wariantDrill") },
            { id: "panel", etykieta: t("wariantPanel") },
          ]}
          wybrana={wariant}
          onWybor={(id) => onWariant(id as WariantObszarow)}
          ariaLabel={t("wyborWariantu")}
        />
        <button
          type="button"
          onClick={() => akcje.nowyPodobszar(null)}
          className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded text-xs focus:outline-none"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <Plus size={13} />
          {t("nowyObszar")}
        </button>
      </div>

      {wariant === "sekcje" && (
        <ObszarySekcje dane={dane} statusConfig={statusConfig} focusedTaskId={focusedTaskId} onFocus={onFocus} onOpen={onOpen} akcje={akcje} />
      )}
      {wariant === "drill" && (
        <ObszaryDrill obszary={obszary} dane={dane} statusConfig={statusConfig} focusedTaskId={focusedTaskId} onFocus={onFocus} onOpen={onOpen} akcje={akcje} />
      )}
      {wariant === "panel" && (
        <>
          {/* Panel boczny wymaga szerokiego ekranu (C-31) — poniżej `lg` ten wariant pokazuje
              sekcje, żeby wybór z komputera nie zostawił telefonu z bezużyteczną kolumną. */}
          <div className="hidden lg:flex flex-1 min-h-0">
            <ObszaryPanel dane={dane} statusConfig={statusConfig} focusedTaskId={focusedTaskId} onFocus={onFocus} onOpen={onOpen} akcje={akcje} />
          </div>
          <div className="lg:hidden flex-1 min-h-0 flex flex-col">
            <ObszarySekcje dane={dane} statusConfig={statusConfig} focusedTaskId={focusedTaskId} onFocus={onFocus} onOpen={onOpen} akcje={akcje} />
          </div>
        </>
      )}

      {(dialog?.typ === "nowy" || dialog?.typ === "zmiana") && (
        <Modal
          onClose={() => setDialog(null)}
          title={dialog.typ === "nowy" ? t("nowyObszarTytul") : t("zmianaNazwyTytul")}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("anuluj")}
              </button>
              <button
                type="button"
                onClick={zapiszDialog}
                disabled={pending || !nazwa.trim()}
                className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
              >
                {t("zapisz")}
              </button>
            </div>
          }
        >
          <input
            autoFocus
            value={nazwa}
            onChange={(e) => setNazwa(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") zapiszDialog(); }}
            placeholder={t("nazwaObszaru")}
            className="w-full px-3 py-2 rounded text-sm focus:outline-none"
            style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </Modal>
      )}

      {dialog?.typ === "przenies" && (
        <Modal
          onClose={() => setDialog(null)}
          title={t("przeniesTytul", { nazwa: dialog.obszar.name })}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("anuluj")}
              </button>
              <button
                type="button"
                onClick={zapiszDialog}
                disabled={pending}
                className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
              >
                {t("przenies")}
              </button>
            </div>
          }
        >
          <select
            value={celPrzeniesienia}
            onChange={(e) => setCelPrzeniesienia(e.target.value)}
            className="w-full px-3 py-2 rounded text-sm focus:outline-none"
            style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">{t("szczytDrzewa")}</option>
            {celePrzeniesienia.map(({ obszar, glebokosc }) => (
              <option key={obszar.id} value={obszar.id}>
                {" ".repeat(glebokosc * 3) + obszar.name}
              </option>
            ))}
          </select>
        </Modal>
      )}

      {dialog?.typ === "usun" && (
        <Modal
          onClose={() => setDialog(null)}
          title={t("usunTytul", { nazwa: dialog.obszar.name })}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("anuluj")}
              </button>
              <button
                type="button"
                onClick={() => usunObszar("scal")}
                disabled={pending}
                className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {t("usunScal")}
              </button>
              <button
                type="button"
                onClick={() => usunObszar("poddrzewo")}
                disabled={pending}
                className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-red)", color: "var(--on-accent)" }}
              >
                {liczbaUsuwanych > 1 ? t("usunPoddrzewoN", { n: liczbaUsuwanych }) : t("usunPoddrzewo")}
              </button>
            </div>
          }
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("usunOpis")}
          </p>
        </Modal>
      )}
    </div>
  );
}

/** ⋮ przy nagłówku obszaru — akcje drzewa (menu wyłącznie z AKCJAMI, bez stanu — reguła ze 100). */
export function MenuObszaru({ obszar, akcje }: { obszar: ObszarDTO; akcje: AkcjeObszaru }) {
  const t = useTranslations("modules.tasks.ObszaryWidok");
  const [otwarte, setOtwarte] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOtwarte((v) => !v); }}
        className="p-1 rounded focus:outline-none"
        style={{ color: "var(--text-muted)" }}
        title={t("akcjeObszaru")}
        aria-label={t("akcjeObszaru")}
        aria-expanded={otwarte}
      >
        <MoreVertical size={14} />
      </button>
      {otwarte && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setOtwarte(false); }} />
          <div
            className="absolute right-0 top-full z-40 mt-1 w-48 rounded-md py-1 shadow-lg"
            style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)" }}
          >
            {(
              [
                { klucz: "zmienNazwe", Icon: Pencil, onClick: () => akcje.zmienNazwe(obszar) },
                { klucz: "nowyPodobszar", Icon: FolderPlus, onClick: () => akcje.nowyPodobszar(obszar.id) },
                { klucz: "przenies", Icon: FolderInput, onClick: () => akcje.przenies(obszar) },
              ] as const
            ).map(({ klucz, Icon, onClick }) => (
              <button
                key={klucz}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOtwarte(false); onClick(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <Icon size={13} />
                {t(klucz)}
              </button>
            ))}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOtwarte(false); akcje.usun(obszar); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--accent-red)" }}
            >
              <Trash2 size={13} />
              {t("usun")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
