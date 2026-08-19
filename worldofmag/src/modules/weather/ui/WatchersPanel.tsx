"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, Trash2, Loader2, RefreshCw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { type AiCostUsage } from "@/components/ui/AiCostBadge";
import { AiContentMeta, AiContentPending } from "@/components/ui/AiContentMeta";
import type { AiSectionMode } from "@/platform/ai/sectionMode";
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
  const t = useTranslations("modules.weather.WatchersPanel");
  const router = useRouter();
  const { showToast } = useToast();
  const [verdicts, setVerdicts] = useState<WatcherVerdict[] | null>(null);
  const [usage, setUsage] = useState<AiCostUsage | undefined>();
  const [loading, setLoading] = useState(false);
  // 080 (Z11): stan sekcji AI — dokładnie ten sam zestaw, co w „Co robić?".
  const [pending, setPending] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [stale, setStale] = useState(false);
  const [mode, setMode] = useState<AiSectionMode>("onDemand");
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  // 037: ten sam formularz obsługuje dodawanie i edycję — `editing` trzyma obserwatora do poprawy.
  const [editing, setEditing] = useState<WatcherDTO | null>(null);

  /**
   * 080 (Z11): `force` znaczy „użytkownik właśnie o to poprosił".
   *
   * Bez niego wołanie tylko ODCZYTUJE stan sekcji: jeśli ocena już istnieje, wraca z pamięci,
   * a jeśli nie i tryb jest „na żądanie" — serwer odpowiada `pending` i nic nie kosztuje.
   * Kliknięcie w „Oceń" albo w odświeżenie jest wyraźną prośbą, więc idzie z `force`.
   */
  const evaluate = useCallback(
    (force = false) => {
      if (!coords || watchers.filter((w) => w.enabled).length === 0) {
        setVerdicts([]);
        setPending(false);
        return;
      }
      setLoading(true);
      evaluateWatchers(coords.lat, coords.lon, coords.label, { force })
        .then((r) => {
          setPending(r.pending);
          setMode(r.mode);
          setGeneratedAt(r.generatedAt ?? undefined);
          setStale(r.stale);
          if (!r.pending) {
            setVerdicts(r.verdicts);
            setUsage(r.usage);
          }
        })
        .catch((e) => {
          showToast(e.message ?? "Nie udało się ocenić obserwatorów", "error");
          setVerdicts([]);
          setPending(false);
        })
        .finally(() => setLoading(false));
    },
    [coords, watchers, showToast]
  );

  // 080 (Z11): to NIE jest generowanie przy wejściu — to odczyt stanu sekcji.
  //
  // Przed tą zmianą dokładnie ten efekt wołał model przy każdym wejściu na moduł Pogoda: bez
  // pamięci, bez trybu i bez możliwości powstrzymania. Stąd wieczny spinner i „bardzo często
  // w ogóle nie działają" — każda odmowa modelu kończyła się pustą listą. Teraz wywołanie bez
  // `force` odpowiada z pamięci albo mówi `pending`, więc wejście na stronę nic nie kosztuje.
  useEffect(() => {
    evaluate(false);
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
        // Zapis zmienia WARUNEK obserwatora, więc dotychczasowa ocena opisuje już nieistniejące
        // pytanie. To jawna prośba użytkownika, więc liczymy od nowa (`force`), a nie czekamy.
        evaluate(true);
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
        evaluate(false);
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
              onClick={() => evaluate(true)}
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
          {t("brakObserwatorowDodajGotowy")}
        </p>
      ) : pending ? (
        /* 080 (Z11): sekcja CZEKA na kliknięcie. To nie jest błąd ani pusta lista — i dlatego ma
           własny stan, a nie ten sam szary komunikat, co awaria (lekcja z 038). */
        <AiContentPending
          title={t("obserwatoryCzekaja")}
          hint={t("obserwatoryCzekajaOpis")}
          actionLabel={t("ocenObserwatory")}
          busy={loading}
          onGenerate={() => evaluate(true)}
          sectionKind="weather.watchers"
          mode={mode}
          onModeChange={setMode}
        />
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
                      title={t("usunObserwator")}
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

      {/* 080 (Z11): pasek sekcji AI — kiedy ocena powstała, czy jest nieaktualna, ile kosztowała
          i kiedy ma powstawać sama. Ten sam komponent, co w pozostałych sekcjach AI. */}
      {!pending && watchers.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <AiContentMeta
            generatedAt={generatedAt}
            stale={stale}
            busy={loading}
            onRefresh={() => evaluate(true)}
            refreshLabel={t("ocenPonownie")}
            staleHint={t("prognozaAlboObserwatoryZmienily")}
            usage={usage}
            sectionKind="weather.watchers"
            mode={mode}
            onModeChange={setMode}
          />
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
  const t = useTranslations("modules.weather.WatchersPanel");
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
          placeholder={t("nazwaNpWypadW")}
          className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          placeholder={t("coObserwowacNpWeekend")}
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
