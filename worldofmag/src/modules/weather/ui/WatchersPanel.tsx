"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, Trash2, Loader2, RefreshCw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";
import { WEATHER_PRESETS, HORIZON_META, type Horizon } from "../lib/presets";
import {
  evaluateWatchers,
  addPresetWatcher,
  addCustomWatcher,
  deleteWatcher,
  updateWatcher,
  type WatcherDTO,
  type WatcherVerdict,
} from "../actions/weather";

/**
 * 037: etykiety mówią o SPEŁNIENIU WARUNKU obserwatora, nie o urodzie pogody.
 *
 * Uwaga na odczytanie koloru: zieleń oznacza „to, o co pytałeś, się dzieje" — dla obserwatora
 * ostrzegawczego („Burze") spełnienie jest złą wiadomością, mimo zielonego znacznika. Stąd `title`
 * przy każdym statusie: bez niego zieleń przy nadchodzącej burzy byłaby myląca tak samo jak dawne
 * „Sprzyja" przy obserwatorze mokrego weekendu.
 */
const STATUS_STYLE: Record<WatcherVerdict["status"], { color: string; label: string; hint: string }> = {
  met: {
    color: "var(--accent-green)",
    label: "Spełnione",
    hint: "Warunek opisany w obserwatorze zachodzi",
  },
  partial: {
    color: "var(--accent-amber)",
    label: "Częściowo",
    hint: "Warunek zachodzi częściowo lub niepewnie",
  },
  unmet: {
    color: "var(--text-secondary)",
    label: "Niespełnione",
    hint: "Warunek opisany w obserwatorze nie zachodzi",
  },
  unknown: {
    color: "var(--text-muted)",
    label: "Brak danych",
    hint: "Prognoza nie daje podstaw do rozstrzygnięcia",
  },
};

export function WatchersPanel({
  watchers,
  coords,
  usdPlnRate,
}: {
  watchers: WatcherDTO[];
  coords: { lat: number; lon: number; label: string } | null;
  usdPlnRate?: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [verdicts, setVerdicts] = useState<WatcherVerdict[] | null>(null);
  const [usage, setUsage] = useState<AiCostUsage | undefined>();
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  // 037: ten sam formularz obsługuje dodawanie i edycję — `editing` trzyma obserwatora do poprawy.
  const [editing, setEditing] = useState<WatcherDTO | null>(null);

  const evaluate = useCallback(() => {
    if (!coords || watchers.filter((w) => w.enabled).length === 0) {
      setVerdicts([]);
      return;
    }
    setLoading(true);
    evaluateWatchers(coords.lat, coords.lon, coords.label)
      .then((r) => {
        setVerdicts(r.verdicts);
        setUsage(r.usage);
      })
      .catch((e) => {
        showToast(e.message ?? "Nie udało się ocenić obserwatorów", "error");
        setVerdicts([]);
      })
      .finally(() => setLoading(false));
  }, [coords, watchers, showToast]);

  useEffect(() => {
    evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lon, watchers.length]);

  function run(fn: () => Promise<void>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) showToast(ok, "success");
        router.refresh();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  /**
   * 037: zapis EDYCJI obserwatora musi unieważnić dotychczasową ocenę. Werdykty nie są trzymane w
   * bazie, tylko liczone z definicji obserwatora — po zmianie warunku poprzedni status opisywałby
   * już nieistniejące pytanie. Automatyczne przeliczenie z `useEffect` tu nie zadziała: jego zależność
   * to `watchers.length`, a edycja liczby obserwatorów nie zmienia. Dlatego gasimy oceny i liczymy
   * je jawnie po zapisie.
   */
  function saveEdit(fn: () => Promise<void>) {
    setVerdicts(null);
    startTransition(async () => {
      try {
        await fn();
        showToast("Zapisano obserwator", "success");
        router.refresh();
        evaluate();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
        evaluate();
      }
    });
  }

  const verdictById = new Map((verdicts ?? []).map((v) => [v.id, v]));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
          <Bell size={18} className="text-[var(--accent-amber)]" /> Obserwatory pogody
        </h2>
        <div className="flex gap-2">
          {watchers.length > 0 && (
            <button
              onClick={evaluate}
              disabled={loading}
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Przelicz oceny"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={14} /> Dodaj
          </Button>
        </div>
      </div>

      {watchers.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Brak obserwatorów. Dodaj gotowy preset (np. „Weekend bez deszczu”, „Bieganie”) albo własny
          opisany naturalnym językiem — AI oceni je względem prognozy.
        </p>
      ) : loading && verdicts === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : (
        <div className="space-y-2">
          {watchers.map((w) => {
            const v = verdictById.get(w.id);
            const style = v ? STATUS_STYLE[v.status] : null;
            return (
              <div
                key={w.id}
                className={cn(
                  "rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3",
                  !w.enabled && "opacity-50"
                )}
              >
                {/* 038: na telefonie tytuł, status i horyzont nie mieszczą się w jednym wierszu —
                    tytuł jest teraz osobno i zawija się, a znaczniki idą pod nim. */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block break-words font-medium text-[var(--text-primary)]">
                      {w.title}
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {style && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ color: style.color, border: `1px solid ${style.color}` }}
                          title={style.hint}
                        >
                          {style.label}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {HORIZON_META[w.horizon].label}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => run(() => updateWatcher(w.id, { enabled: !w.enabled }))}
                      className="rounded p-2 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      {w.enabled ? "Wyłącz" : "Włącz"}
                    </button>
                    <button
                      onClick={() => setEditing(w)}
                      className="rounded p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-blue)]"
                      title="Edytuj obserwator"
                      aria-label={`Edytuj obserwator ${w.title}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => run(() => deleteWatcher(w.id))}
                      className="rounded p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)]"
                      title="Usuń obserwator"
                      aria-label={`Usuń obserwator ${w.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {v && (
                  <div className="mt-1.5 text-sm">
                    <span className="font-medium text-[var(--text-primary)]">{v.verdict}</span>
                    {v.detail && <span className="text-[var(--text-secondary)]"> — {v.detail}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {usage && (
        <div className="mt-3 flex justify-end border-t border-[var(--border)] pt-2">
          <AiCostBadge usage={usage} rate={usdPlnRate} />
        </div>
      )}

      {adding && (
        <WatcherFormModal
          existingPresets={watchers.filter((w) => w.kind === "preset").map((w) => w.presetKey ?? "")}
          onClose={() => setAdding(false)}
          onAddPreset={(key) =>
            run(async () => {
              await addPresetWatcher(key);
            }, "Dodano obserwator")
          }
          onSubmit={(d) =>
            run(async () => {
              await addCustomWatcher(d);
            }, "Dodano obserwator")
          }
        />
      )}

      {editing && (
        <WatcherFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(d) => saveEdit(() => updateWatcher(editing.id, d))}
        />
      )}
    </div>
  );
}

/**
 * 037: JEDEN formularz obserwatora dla dodawania i edycji (C-53 — zamiast dwóch bliźniaczych modali).
 * Bez `initial` zachowuje się jak dotychczasowy „Dodaj" (z galerią presetów); z `initial` jest
 * formularzem edycji, w którym galeria presetów nie ma sensu — obserwator już istnieje, zmieniamy
 * tylko jego definicję. Edycja obserwatora z presetu też jest dozwolona: `presetKey` zostaje, więc
 * ten sam preset nadal nie da się dodać drugi raz, ale treść i horyzont są własnością użytkownika.
 */
function WatcherFormModal({
  initial,
  existingPresets,
  onClose,
  onAddPreset,
  onSubmit,
}: {
  initial?: WatcherDTO;
  existingPresets?: string[];
  onClose: () => void;
  onAddPreset?: (key: string) => void;
  onSubmit: (d: { title: string; query: string; horizon: Horizon }) => void;
}) {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [query, setQuery] = useState(initial?.query ?? "");
  const [horizon, setHorizon] = useState<Horizon>(initial?.horizon ?? "weekend");
  const has = new Set(existingPresets ?? []);

  function submit() {
    if (!title.trim() || !query.trim()) return;
    onSubmit({ title: title.trim(), query: query.trim(), horizon });
    onClose();
  }

  return (
    <Modal
      onClose={onClose}
      title={isEdit ? "Edytuj obserwator pogody" : "Dodaj obserwator pogody"}
      wide
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>
          <Button size="sm" onClick={submit} disabled={!title.trim() || !query.trim()}>
            {isEdit ? "Zapisz zmiany" : "Dodaj własny"}
          </Button>
        </>
      }
    >
      {!isEdit && onAddPreset && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Gotowe presety
          </h4>
          <div className="flex flex-wrap gap-2">
            {WEATHER_PRESETS.map((p) => (
              <button
                key={p.key}
                disabled={has.has(p.key)}
                onClick={() => {
                  onAddPreset(p.key);
                  onClose();
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  has.has(p.key)
                    ? "cursor-not-allowed border-[var(--border)] text-[var(--text-muted)] opacity-50"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                {p.emoji} {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {isEdit ? "Definicja obserwatora" : "Własny obserwator (opisany naturalnym językiem)"}
        </h4>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nazwa (np. Wypad w góry)"
          className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          placeholder="Co obserwować? np. weekend dobry na wspinaczkę: sucho, bez burz, słaby wiatr"
          className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--text-secondary)]">Horyzont:</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as Horizon)}
            className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
          >
            {(Object.keys(HORIZON_META) as Horizon[]).map((h) => (
              <option key={h} value={h}>
                {HORIZON_META[h].label}
              </option>
            ))}
          </select>
        </div>
        {isEdit && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Po zapisaniu ocena zostanie policzona od nowa dla zmienionej definicji.
          </p>
        )}
      </div>
    </Modal>
  );
}
