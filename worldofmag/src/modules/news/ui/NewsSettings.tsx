"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { SUMMARY_LENGTHS } from "@/lib/news/format";
import {
  createSource,
  updateSource,
  deleteSource,
  setDefaultSummaryLength,
  type SourceDTO,
  type SummaryLength,
} from "../actions/news";

export function NewsSettings({
  sources,
  defaultLength,
  onChanged,
}: {
  sources: SourceDTO[];
  defaultLength: SummaryLength;
  onChanged: () => void;
}) {
  const t = useTranslations("modules.news.NewsSettings");
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [descriptor, setDescriptor] = useState("");

  function run(fn: () => Promise<void>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) showToast(ok, "success");
        onChanged();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  function add() {
    if (!name.trim() || !rssUrl.trim()) {
      showToast("Podaj nazwę i adres RSS", "error");
      return;
    }
    run(async () => {
      await createSource({ name, rssUrl, homepageUrl, descriptor });
      setShowAdd(false);
      setName("");
      setRssUrl("");
      setHomepageUrl("");
      setDescriptor("");
    }, "Dodano źródło");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
          <Settings2 size={18} /> {t("zrodlaWiadomosci")}
        </h2>
        <div className="space-y-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => run(() => updateSource(s.id, { enabled: !s.enabled }))}
                  className="h-4 w-4 accent-[var(--accent-blue)]"
                />
                <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
              </label>
              {/* 040: dowolny opis zamiast wyboru z trzech kategorii — zestaw kanałów dawno
                  wyszedł poza politykę. Zapis na `blur`, żeby nie strzelać akcją przy każdej
                  wpisanej literze. */}
              <SourceDescriptorInput
                value={s.descriptor}
                onSave={(next) => run(() => updateSource(s.id, { descriptor: next }))}
              />
              {/* 040: `min-w-0` jest tu WARUNKIEM działania `truncate`, nie ozdobą. Element `flex-1`
                  ma domyślnie `min-width: auto`, więc nie potrafi zwęzić się poniżej swojej treści —
                  długi adres RSS rozpychał wiersz, a przez niego całą stronę (poziomy scroll na
                  telefonie). `truncate` nigdy nie dostawał szansy zadziałać, bo nie było czego
                  przycinać: tekst ucinała dopiero krawędź ekranu. */}
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]">{s.rssUrl}</span>
              <button
                onClick={() => run(() => deleteSource(s.id), "Usunięto źródło")}
                className="text-[var(--text-muted)] hover:text-[var(--accent-red)]"
                title={t("usunZrodlo")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {showAdd ? (
          <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("nazwaZrodlaNpTvn24")}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <input
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="Adres RSS (https://…/rss)"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <input
              value={homepageUrl}
              onChange={(e) => setHomepageUrl(e.target.value)}
              placeholder="Adres strony (opcjonalnie)"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <div className="flex items-center gap-2">
              <input
                value={descriptor}
                onChange={(e) => setDescriptor(e.target.value)}
                maxLength={60}
                placeholder="Opis (np. pop-science)"
                className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <Button size="sm" onClick={add}>
                Dodaj
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> {t("dodajZrodlo")}
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
          {t("domyslnaDlugoscStreszczen")}
        </h2>
        <div className="flex gap-2">
          {SUMMARY_LENGTHS.map((l) => (
            <button
              key={l.key}
              onClick={() => run(() => setDefaultSummaryLength(l.key), "Zapisano")}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                defaultLength === l.key
                  ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 040: pole opisu źródła zapisywane na `blur` (albo Enterem), nie przy każdej literze.
 *
 * Zapis „na zmianę" wysyłałby Server Action po każdym znaku, a przy okazji `revalidatePath` —
 * czyli kilkadziesiąt round-tripów na jeden wpisany opis. Trzymamy więc wartość lokalnie i
 * zapisujemy dopiero, gdy użytkownik skończy pisać i faktycznie coś zmienił.
 */
function SourceDescriptorInput({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}) {
  const t = useTranslations("modules.news.NewsSettings");
  const [draft, setDraft] = useState(value);

  // Wartość z serwera wygrywa, gdy zmieni się poza tym polem (np. po odświeżeniu listy).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const next = draft.trim();
    if (next === value.trim()) return;
    onSave(next);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
      maxLength={60}
      placeholder={t("opisZrodla")}
      aria-label={t("opisZrodla")}
      className="w-32 min-w-0 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)]"
    />
  );
}
