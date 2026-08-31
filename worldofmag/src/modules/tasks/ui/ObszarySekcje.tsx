"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { TaskRow } from "./TaskRow";
import { MenuObszaru, type AkcjeObszaru, type DaneObszarow } from "./ObszaryWidok";
import type { ProjectStatusConfig } from "@/types";

/**
 * 117 (AC-3): wariant domyślny — zwijane sekcje odzwierciedlające drzewo (wcięcia głębokości).
 * Zwinięcie sekcji chowa też jej podobszary (to jedna gałąź, nie sąsiednie listy). Zadania bez
 * obszaru mają własną, wyciszoną sekcję na końcu — żadne zadanie nie znika i się nie dubluje,
 * bo wszystkie sekcje czytają jeden podział `dane.zadaniaWObszarze`.
 */
export function ObszarySekcje({
  dane,
  statusConfig,
  focusedTaskId,
  onFocus,
  onOpen,
  akcje,
}: {
  dane: DaneObszarow;
  statusConfig: ProjectStatusConfig;
  focusedTaskId: string | null;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
  akcje: AkcjeObszaru;
}) {
  const t = useTranslations("modules.tasks.ObszarySekcje");
  const [zwiniete, setZwiniete] = useState<Set<string>>(new Set());
  const bezObszaru = dane.zadaniaWObszarze.get(null) ?? [];

  function przelacz(id: string) {
    setZwiniete((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Zwinięta sekcja pomija całe swoje poddrzewo: trzymamy głębokość, poniżej której pomijamy.
  const widoczne: typeof dane.drzewo = [];
  let pomijajPonizej: number | null = null;
  for (const wezel of dane.drzewo) {
    if (pomijajPonizej !== null && wezel.glebokosc > pomijajPonizej) continue;
    pomijajPonizej = null;
    widoczne.push(wezel);
    if (zwiniete.has(wezel.obszar.id)) pomijajPonizej = wezel.glebokosc;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {dane.drzewo.length === 0 && (
        <p className="px-4 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("brakObszarow")}
        </p>
      )}
      {widoczne.map(({ obszar, glebokosc }) => {
        const zadania = dane.zadaniaWObszarze.get(obszar.id) ?? [];
        const otwarta = !zwiniete.has(obszar.id);
        return (
          <div key={obszar.id}>
            <div
              className="flex items-center gap-1 pr-2 text-xs font-medium sticky top-0"
              style={{
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-base)",
                borderBottom: "1px solid var(--border)",
                // Wcięcie głębokości — capowane, żeby głębokie drzewo nie zjadło wąskiego ekranu.
                paddingLeft: `${16 + Math.min(glebokosc, 6) * 14}px`,
              }}
            >
              <button
                type="button"
                onClick={() => przelacz(obszar.id)}
                aria-expanded={otwarta}
                className="flex flex-1 min-w-0 items-center gap-2 py-1.5 text-left focus:outline-none"
              >
                <ChevronRight
                  size={12}
                  style={{ transition: "transform 0.12s", transform: otwarta ? "rotate(90deg)" : "none", flexShrink: 0 }}
                />
                <span className="truncate">{obszar.name}</span>
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  ({dane.liczbaWPoddrzewie.get(obszar.id) ?? zadania.length})
                </span>
              </button>
              <MenuObszaru obszar={obszar} akcje={akcje} />
            </div>
            {otwarta &&
              zadania.map((z) => (
                <TaskRow
                  key={z.id}
                  task={z}
                  isFocused={focusedTaskId === z.id}
                  isSelected={false}
                  onFocus={() => onFocus(z.id)}
                  onOpen={() => onOpen(z.id)}
                  statusConfig={statusConfig}
                  indent={Math.min(glebokosc, 6)}
                />
              ))}
          </div>
        );
      })}
      {bezObszaru.length > 0 && (
        <div>
          <div
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium sticky top-0"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
          >
            {t("bezObszaru")}
            <span style={{ fontWeight: 400 }}>({bezObszaru.length})</span>
          </div>
          {bezObszaru.map((z) => (
            <TaskRow
              key={z.id}
              task={z}
              isFocused={focusedTaskId === z.id}
              isSelected={false}
              onFocus={() => onFocus(z.id)}
              onOpen={() => onOpen(z.id)}
              statusConfig={statusConfig}
            />
          ))}
        </div>
      )}
    </div>
  );
}
