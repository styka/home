"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { LEANING_META } from "@/lib/news/sources";
import { SUMMARY_LENGTHS } from "@/lib/news/format";
import {
  createSource,
  updateSource,
  deleteSource,
  setDefaultSummaryLength,
  type SourceDTO,
  type SummaryLength,
} from "@/actions/news";
import type { Leaning } from "@/lib/news/sources";

const LEANINGS: Leaning[] = ["left", "center", "right"];

export function NewsSettings({
  sources,
  defaultLength,
  onChanged,
}: {
  sources: SourceDTO[];
  defaultLength: SummaryLength;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [leaning, setLeaning] = useState<Leaning>("center");

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
      await createSource({ name, rssUrl, homepageUrl, leaning });
      setShowAdd(false);
      setName("");
      setRssUrl("");
      setHomepageUrl("");
      setLeaning("center");
    }, "Dodano źródło");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
          <Settings2 size={18} /> Źródła wiadomości
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
              <select
                value={s.leaning}
                onChange={(e) => run(() => updateSource(s.id, { leaning: e.target.value as Leaning }))}
                className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)]"
              >
                {LEANINGS.map((l) => (
                  <option key={l} value={l}>
                    {LEANING_META[l].label}
                  </option>
                ))}
              </select>
              <span className="flex-1 truncate text-xs text-[var(--text-muted)]">{s.rssUrl}</span>
              <button
                onClick={() => run(() => deleteSource(s.id), "Usunięto źródło")}
                className="text-[var(--text-muted)] hover:text-[var(--accent-red)]"
                title="Usuń źródło"
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
              placeholder="Nazwa źródła (np. TVN24)"
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
              <select
                value={leaning}
                onChange={(e) => setLeaning(e.target.value as Leaning)}
                className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm text-[var(--text-primary)]"
              >
                {LEANINGS.map((l) => (
                  <option key={l} value={l}>
                    {LEANING_META[l].label}
                  </option>
                ))}
              </select>
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
            <Plus size={14} /> Dodaj źródło
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
          Domyślna długość streszczeń
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
