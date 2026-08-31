"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Folder, Inbox, List } from "lucide-react";
import { TaskRow } from "./TaskRow";
import { MenuObszaru, type AkcjeObszaru, type DaneObszarow } from "./ObszaryWidok";
import type { ProjectStatusConfig } from "@/types";

/** Wybór w drzewie panelu: wszystko / konkretny obszar (z poddrzewem) / bez obszaru. */
type Wybor = { rodzaj: "wszystkie" } | { rodzaj: "obszar"; id: string } | { rodzaj: "bez" };

/**
 * 117 (AC-3/AC-4): wariant desktopowy — stałe drzewo obszarów obok listy; wybór obszaru
 * FILTRUJE listę do jego poddrzewa (obszar to gałąź, nie pojedynczy folder). Renderowany
 * wyłącznie od `lg:` w górę (na węższych ekranach `ObszaryWidok` podstawia sekcje).
 */
export function ObszaryPanel({
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
  const t = useTranslations("modules.tasks.ObszaryPanel");
  const [wybor, setWybor] = useState<Wybor>({ rodzaj: "wszystkie" });

  const bezObszaru = dane.zadaniaWObszarze.get(null) ?? [];
  const wszystkie = useMemo(() => {
    // Kolejność drzewa: sekcjami obszarów, na końcu bez obszaru — spójna z wariantem sekcji.
    const listy = dane.drzewo.map((w) => dane.zadaniaWObszarze.get(w.obszar.id) ?? []);
    return ([] as typeof bezObszaru).concat(...listy, bezObszaru);
  }, [dane, bezObszaru]);

  const zadania = useMemo(() => {
    if (wybor.rodzaj === "wszystkie") return wszystkie;
    if (wybor.rodzaj === "bez") return bezObszaru;
    // Poddrzewo wybranego: spłaszczenie ma rodzica przed dziećmi, więc bierzemy spójny wycinek
    // od wybranego do pierwszego węzła o głębokości nie większej niż jego.
    const start = dane.drzewo.findIndex((w) => w.obszar.id === wybor.id);
    if (start === -1) return wszystkie;
    const bazowa = dane.drzewo[start].glebokosc;
    const wycinek = [dane.drzewo[start]];
    for (let i = start + 1; i < dane.drzewo.length && dane.drzewo[i].glebokosc > bazowa; i++) {
      wycinek.push(dane.drzewo[i]);
    }
    return wycinek.flatMap((w) => dane.zadaniaWObszarze.get(w.obszar.id) ?? []);
  }, [wybor, wszystkie, bezObszaru, dane]);

  const aktywnyId = wybor.rodzaj === "obszar" ? wybor.id : null;

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <div
        className="w-60 flex-shrink-0 overflow-y-auto border-r py-1"
        style={{ borderColor: "var(--border)" }}
        role="tree"
        aria-label={t("drzewoObszarow")}
      >
        <button
          type="button"
          onClick={() => setWybor({ rodzaj: "wszystkie" })}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs focus:outline-none"
          style={{
            color: wybor.rodzaj === "wszystkie" ? "var(--text-primary)" : "var(--text-secondary)",
            backgroundColor: wybor.rodzaj === "wszystkie" ? "var(--bg-hover)" : "transparent",
          }}
        >
          <List size={13} style={{ flexShrink: 0 }} />
          <span className="flex-1 truncate">{t("wszystkieZadania")}</span>
          <span style={{ color: "var(--text-muted)" }}>{wszystkie.length}</span>
        </button>
        {dane.drzewo.map(({ obszar, glebokosc }) => (
          <div
            key={obszar.id}
            className="group flex items-center gap-1 pr-1"
            style={{ backgroundColor: aktywnyId === obszar.id ? "var(--bg-hover)" : "transparent" }}
          >
            <button
              type="button"
              onClick={() => setWybor({ rodzaj: "obszar", id: obszar.id })}
              className="flex flex-1 min-w-0 items-center gap-2 py-1.5 text-left text-xs focus:outline-none"
              style={{
                color: aktywnyId === obszar.id ? "var(--text-primary)" : "var(--text-secondary)",
                paddingLeft: `${12 + Math.min(glebokosc, 6) * 12}px`,
              }}
            >
              <Folder size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="flex-1 truncate">{obszar.name}</span>
              <span style={{ color: "var(--text-muted)" }}>{dane.liczbaWPoddrzewie.get(obszar.id) ?? 0}</span>
            </button>
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              <MenuObszaru obszar={obszar} akcje={akcje} />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setWybor({ rodzaj: "bez" })}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs focus:outline-none"
          style={{
            color: wybor.rodzaj === "bez" ? "var(--text-primary)" : "var(--text-muted)",
            backgroundColor: wybor.rodzaj === "bez" ? "var(--bg-hover)" : "transparent",
          }}
        >
          <Inbox size={13} style={{ flexShrink: 0 }} />
          <span className="flex-1 truncate">{t("bezObszaru")}</span>
          <span style={{ color: "var(--text-muted)" }}>{bezObszaru.length}</span>
        </button>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {zadania.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
            {t("brakZadan")}
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
    </div>
  );
}
