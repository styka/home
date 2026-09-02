"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Folder } from "lucide-react";
import { TaskRow } from "./TaskRow";
import { MenuObszaru, type AkcjeObszaru, type DaneObszarow } from "./ObszaryWidok";
import type { ObszarDTO } from "../actions/obszary";
import type { ProjectStatusConfig } from "@/types";

/**
 * 117 (AC-3/AC-4): wariant drill-down — wchodzisz w obszar, widzisz jego podobszary (kafle
 * z licznikiem CAŁEGO poddrzewa) i jego zadania; okruszki i „wstecz" są zawsze widoczne
 * (droga powrotna to warunek tego wariantu). Czytelny na telefonie: jedna gałąź na ekranie.
 */
export function ObszaryDrill({
  obszary,
  dane,
  statusConfig,
  focusedTaskId,
  onFocus,
  onOpen,
  akcje,
}: {
  obszary: ObszarDTO[];
  dane: DaneObszarow;
  statusConfig: ProjectStatusConfig;
  focusedTaskId: string | null;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
  akcje: AkcjeObszaru;
}) {
  const t = useTranslations("modules.tasks.ObszaryDrill");
  const [biezacyId, setBiezacyId] = useState<string | null>(null);

  const poId = useMemo(() => new Map(obszary.map((o) => [o.id, o])), [obszary]);
  // Obszar mógł zniknąć pod nami (usunięty w innym oknie / rewalidacja) — wracamy na szczyt.
  const biezacy = biezacyId !== null ? poId.get(biezacyId) ?? null : null;
  const efektywnyId = biezacy?.id ?? null;

  const okruszki = useMemo(() => {
    const sciezka: ObszarDTO[] = [];
    let krok = biezacy;
    while (krok) {
      sciezka.unshift(krok);
      krok = krok.parentId !== null ? poId.get(krok.parentId) ?? null : null;
    }
    return sciezka;
  }, [biezacy, poId]);

  // Kolejność dzieci jak w spłaszczonym drzewie (order, nazwa).
  const dzieci = useMemo(
    () => dane.drzewo.filter((w) => w.obszar.parentId === efektywnyId).map((w) => w.obszar),
    [dane.drzewo, efektywnyId],
  );
  const zadania = dane.zadaniaWObszarze.get(efektywnyId) ?? [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div
        className="flex items-center gap-1 px-2 py-2 text-xs sticky top-0 z-10"
        style={{ backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
      >
        {biezacy !== null && (
          <button
            type="button"
            onClick={() => setBiezacyId(biezacy.parentId)}
            className="p-1.5 rounded focus:outline-none"
            style={{ color: "var(--text-secondary)" }}
            title={t("wstecz")}
            aria-label={t("wstecz")}
          >
            <ChevronLeft size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setBiezacyId(null)}
          className="px-1 py-1 focus:outline-none"
          style={{ color: biezacy === null ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {t("szczyt")}
        </button>
        {okruszki.map((o) => (
          <span key={o.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <button
              type="button"
              onClick={() => setBiezacyId(o.id)}
              className="truncate px-1 py-1 focus:outline-none"
              style={{ color: o.id === efektywnyId ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              {o.name}
            </button>
          </span>
        ))}
        {biezacy !== null && (
          <div className="ml-auto">
            <MenuObszaru obszar={biezacy} akcje={akcje} />
          </div>
        )}
      </div>

      {dzieci.length > 0 && (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          {dzieci.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setBiezacyId(o.id)}
              className="flex items-center gap-2 rounded-md px-3 py-3 text-left text-sm focus:outline-none"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <Folder size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {dane.liczbaWPoddrzewie.get(o.id) ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Na szczycie „zadania tego poziomu" to zadania bez obszaru — nazwane wprost, żeby nie
          wyglądały na zadania jakiegoś „szczytowego obszaru". */}
      {biezacy === null && zadania.length > 0 && (
        <div
          className="px-4 py-1.5 text-xs font-medium"
          style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
        >
          {t("bezObszaru")} ({zadania.length})
        </div>
      )}
      {zadania.length === 0 && dzieci.length === 0 ? (
        <p className="px-4 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("pustyObszar")}
        </p>
      ) : (
        zadania.map((z) => (
          <TaskRow
            key={z.id}
            task={z}
            isFocused={focusedTaskId === z.id}
            isSelected={false}
            onFocus={() => onFocus(z.id)}
            onOpen={() => onOpen(z.id)}
            statusConfig={statusConfig}
          />
        ))
      )}
    </div>
  );
}
