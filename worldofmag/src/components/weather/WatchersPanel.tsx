"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { WEATHER_PRESETS, HORIZON_META, type Horizon } from "@/lib/weather/presets";
import {
  evaluateWatchers,
  addPresetWatcher,
  addCustomWatcher,
  deleteWatcher,
  updateWatcher,
  type WatcherDTO,
  type WatcherVerdict,
} from "@/actions/weather";

const STATUS_STYLE: Record<WatcherVerdict["status"], { color: string; label: string }> = {
  good: { color: "var(--accent-green)", label: "Sprzyja" },
  warn: { color: "var(--accent-amber)", label: "Uwaga" },
  bad: { color: "var(--accent-red)", label: "Odradzane" },
  info: { color: "var(--text-secondary)", label: "Info" },
};

export function WatchersPanel({
  watchers,
  coords,
}: {
  watchers: WatcherDTO[];
  coords: { lat: number; lon: number; label: string } | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [verdicts, setVerdicts] = useState<WatcherVerdict[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  const evaluate = useCallback(() => {
    if (!coords || watchers.filter((w) => w.enabled).length === 0) {
      setVerdicts([]);
      return;
    }
    setLoading(true);
    evaluateWatchers(coords.lat, coords.lon, coords.label)
      .then(setVerdicts)
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
          Brak obserwatorów. Dodaj gotowy preset (np. „Weekend bez deszczu", „Bieganie") albo własny
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {style && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ color: style.color, border: `1px solid ${style.color}` }}
                      >
                        {style.label}
                      </span>
                    )}
                    <span className="font-medium text-[var(--text-primary)]">{w.title}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {HORIZON_META[w.horizon].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => run(() => updateWatcher(w.id, { enabled: !w.enabled }))}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {w.enabled ? "Wyłącz" : "Włącz"}
                    </button>
                    <button
                      onClick={() => run(() => deleteWatcher(w.id))}
                      className="text-[var(--text-muted)] hover:text-[var(--accent-red)]"
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

      {adding && (
        <AddWatcherModal
          existingPresets={watchers.filter((w) => w.kind === "preset").map((w) => w.presetKey ?? "")}
          onClose={() => setAdding(false)}
          onAddPreset={(key) =>
            run(async () => {
              await addPresetWatcher(key);
            }, "Dodano obserwator")
          }
          onAddCustom={(d) =>
            run(async () => {
              await addCustomWatcher(d);
            }, "Dodano obserwator")
          }
        />
      )}
    </div>
  );
}

function AddWatcherModal({
  existingPresets,
  onClose,
  onAddPreset,
  onAddCustom,
}: {
  existingPresets: string[];
  onClose: () => void;
  onAddPreset: (key: string) => void;
  onAddCustom: (d: { title: string; query: string; horizon: Horizon }) => void;
}) {
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState<Horizon>("weekend");
  const has = new Set(existingPresets);

  return (
    <Modal
      onClose={onClose}
      title="Dodaj obserwator pogody"
      wide
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!title.trim() || !query.trim()) return;
              onAddCustom({ title, query, horizon });
              onClose();
            }}
          >
            Dodaj własny
          </Button>
        </>
      }
    >
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

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Własny obserwator (opisany naturalnym językiem)
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
      </div>
    </Modal>
  );
}
