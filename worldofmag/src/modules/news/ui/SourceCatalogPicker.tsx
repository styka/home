"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  NEWS_CATALOG_CATEGORIES,
  NEWS_CATALOG_COUNTRIES,
  NEWS_CATALOG_LANGUAGES,
  etykietaKraju,
  etykietaJezyka,
  etykietaKategorii,
} from "@/lib/news/katalog";
import { getSourceCatalog, addSourceFromCatalog, type CatalogEntryDTO } from "../actions/katalog";

/**
 * 082 — przeglądarka SYSTEMOWEJ biblioteki źródeł RSS.
 *
 * Do 082 dodanie źródła znaczyło: znajdź adres kanału RSS portalu (zwykle nieopisany nigdzie na
 * jego stronie), przepisz go, wymyśl nazwę i opis. W praktyce nikt tego nie robił i moduł zostawał
 * przy trzech źródłach z pierwszego uruchomienia.
 *
 * Ręczne dodawanie **zostaje** obok — biblioteka ma dopełniać wybór, a nie go zamykać.
 *
 * Filtrowanie idzie NA SERWER (`getSourceCatalog`), a nie po pobranej liście: katalog liczy ponad
 * czterysta wpisów i ma rosnąć, więc to jest okno z wyszukiwarką, nie lista do przewinięcia.
 */
export function SourceCatalogPicker({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useTranslations("modules.news.SourceCatalogPicker");
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");

  const [entries, setEntries] = useState<CatalogEntryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (q: string, kraj: string, jezyk: string, kategoria: string) => {
      setError(null);
      try {
        setEntries(
          await getSourceCatalog({
            q: q || undefined,
            country: kraj || undefined,
            language: jezyk || undefined,
            category: kategoria || undefined,
          }),
        );
      } catch (e: unknown) {
        setEntries([]);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  /**
   * Zwłoka 250 ms przy wyszukiwaniu. Bez niej każda litera to osobna Server Action, a przy
   * czterystu wpisach odpowiedzi wracają w innej kolejności, niż zostały wysłane — lista mrugała
   * wynikami dla przedostatniej frazy. Sprzątanie w `return` odcina zapytanie, które się
   * zdezaktualizowało, zanim zdąży wystartować.
   */
  useEffect(() => {
    const id = setTimeout(() => void load(query, country, language, category), 250);
    return () => clearTimeout(id);
  }, [query, country, language, category, load]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  function dodaj(wpis: CatalogEntryDTO) {
    setBusyId(wpis.id);
    startTransition(async () => {
      try {
        await addSourceFromCatalog(wpis.id);
        // Oznaczamy lokalnie zamiast przeładowywać listę: użytkownik zwykle dodaje kilka źródeł
        // pod rząd i przeładowanie zabierałoby mu pozycję na liście po każdym kliknięciu.
        setEntries((prev) => prev?.map((e) => (e.id === wpis.id ? { ...e, added: true } : e)) ?? prev);
        showToast(t("dodano", { nazwa: wpis.name }), "success");
        onAdded();
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setBusyId(null);
      }
    });
  }

  const selectClass =
    "min-w-0 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm text-[var(--text-primary)]";

  return (
    <Modal open onClose={onClose} title={t("tytul")} wide>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
          <Search size={15} className="shrink-0 text-[var(--text-muted)]" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("szukaj")}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
            <option value="">{t("wszystkieKraje")}</option>
            {NEWS_CATALOG_COUNTRIES.map((c) => (
              <option key={c.key || "intl"} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass}>
            <option value="">{t("wszystkieJezyki")}</option>
            {NEWS_CATALOG_LANGUAGES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="">{t("wszystkieKategorie")}</option>
            {NEWS_CATALOG_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {entries === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-[var(--accent-red)]">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("nicNieZnaleziono")}</p>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium text-[var(--text-primary)]">
                    {e.name}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    {e.descriptor && (
                      <span className="rounded border border-[var(--border)] px-1.5 py-0.5">
                        {e.descriptor}
                      </span>
                    )}
                    <span>{etykietaKraju(e.country)}</span>
                    <span>·</span>
                    <span>{etykietaJezyka(e.language)}</span>
                    <span>·</span>
                    <span>{etykietaKategorii(e.category)}</span>
                  </div>
                </div>
                {e.added ? (
                  // Etykieta, nie wyłączony przycisk: „Dodane" jest informacją o stanie, a wyszarzony
                  // przycisk czyta się jak „chwilowo nie można".
                  <span className="flex shrink-0 items-center gap-1 py-2 text-xs text-[var(--accent-green)]">
                    <Check size={14} /> {t("dodane")}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => dodaj(e)}
                    disabled={busyId === e.id}
                    className={cn("shrink-0", busyId === e.id && "opacity-60")}
                  >
                    {busyId === e.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {t("dodaj")}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
