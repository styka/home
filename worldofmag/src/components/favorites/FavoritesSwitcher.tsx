"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Star, X, Settings } from "lucide-react";
import type { FavoriteViewDTO } from "@/platform/favorites/favoriteViews";

interface FavoritesSwitcherProps {
  /** Ulubione JUŻ przefiltrowane po uprawnieniach (AC-8) — komponent nie robi tego sam. */
  favorites: FavoriteViewDTO[];
  open: boolean;
  onClose: () => void;
}

/**
 * 042: przełącznik ulubionych — lista z wyszukiwaniem, dostępna z KAŻDEJ strony (AC-4).
 *
 * Zbudowany na `cmdk`, które jest już zależnością projektu. Świadomie NIE rozszerzamy istniejącej
 * `command-palette/CommandPalette.tsx`: tamta jest osadzona wyłącznie w module Zakupy, przyjmuje
 * `listId`/`allLists` i operuje na listach zakupowych. Uczynienie jej globalną to osobny feature,
 * a nie skutek uboczny ulubionych (C-53).
 */
export function FavoritesSwitcher({ favorites, open, onClose }: FavoritesSwitcherProps) {
  const t = useTranslations("components.favorites.FavoritesSwitcher");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  function go(path: string) {
    onClose();
    setTimeout(() => router.push(path), 40);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border shadow-2xl overflow-hidden mx-4"
        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ulubione widoki"
      >
        <Command shouldFilter>
          <div className="flex items-center gap-2 px-4 border-b" style={{ borderColor: "var(--border)" }}>
            <Star size={14} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Skocz do ulubionego widoku…"
              className="flex-1 py-3 bg-transparent text-sm focus:outline-none"
              style={{ color: "var(--text-primary)", caretColor: "var(--accent-blue)" }}
            />
            <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>

          <Command.List className="overflow-y-auto" style={{ maxHeight: 360 }}>
            <Command.Empty className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {favorites.length === 0
                ? "Nie masz jeszcze ulubionych widoków."
                : "Żaden ulubiony widok nie pasuje."}
            </Command.Empty>

            {favorites.length > 0 && (
              <Command.Group heading="Ulubione" className="py-1" style={{ color: "var(--text-muted)" } as React.CSSProperties}>
                {favorites.map((f, i) => (
                  <Command.Item
                    key={f.id}
                    value={`${f.label} ${f.path}`}
                    onSelect={() => go(f.path)}
                    className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer focus:outline-none"
                    style={{ color: "var(--text-primary)", "--cmdk-item-selected-bg": "var(--bg-hover)" } as React.CSSProperties}
                  >
                    <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{f.icon}</span>
                    <span className="flex-1 truncate">
                      {f.label}
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{f.path}</span>
                    </span>
                    {f.color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.color, flexShrink: 0 }} />}
                    {i < 9 && <kbd style={{ fontSize: 10, color: "var(--text-muted)" }}>Alt+{i + 1}</kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>

        <div
          className="flex items-center gap-2 px-4 py-2 border-t"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
        >
          <Settings size={12} style={{ color: "var(--text-muted)" }} />
          <button
            onClick={() => go("/settings")}
            className="text-xs"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {t("zarzadzajUlubionymiWUstawieniach")}
          </button>
        </div>
      </div>
    </div>
  );
}
