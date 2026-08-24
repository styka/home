"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, Trash2, Loader2, RefreshCw, Pencil, ListFilter, Rows3, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { type AiCostUsage } from "@/components/ui/AiCostBadge";
import { AiContentMeta, AiContentPending } from "@/components/ui/AiContentMeta";
import type { AiSectionMode } from "@/platform/ai/sectionMode";
import { WEATHER_PRESETS, HORIZON_META, type Horizon } from "../lib/presets";
import { poStanie, wSekcje, type WatchersLayout } from "../lib/uklad";
import {
  evaluateWatchers,
  addPresetWatcher,
  addCustomWatcher,
  deleteWatcher,
  updateWatcher,
  setWatchersView,
  type WatcherDTO,
  type WatcherVerdict,
  type WatcherStatus,
  type WeatherPrefDTO,
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
  pref,
}: {
  watchers: WatcherDTO[];
  coords: { lat: number; lon: number; label: string } | null;
  usdPlnRate?: number;
  /** 082: zapamiętany układ listy. Przychodzi z serwera, więc widok nie mruga przy pierwszym renderze. */
  pref: WeatherPrefDTO;
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
  /** 083 (recenzja): czy ocena przyszła z pamięci — decyduje, czy meldować koszt jako świeży. */
  const [zPamieci, setZPamieci] = useState(true);
  const [mode, setMode] = useState<AiSectionMode>("onDemand");
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  // 037: ten sam formularz obsługuje dodawanie i edycję — `editing` trzyma obserwatora do poprawy.
  const [editing, setEditing] = useState<WatcherDTO | null>(null);
  // 082: układ i filtr listy. Stan lokalny + zapis w tle, żeby klik był natychmiastowy —
  // preferencja układu nie jest danymi, na które warto czekać.
  const [layout, setLayout] = useState<WatchersLayout>(pref.watchersLayout);

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
          setZPamieci(r.fromMemory);
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

  /**
   * 082: dopóki ocena nie powstała, lista NIE UDAJE, że zna stany.
   *
   * To jest warunek, na którym stoi cała reszta tej sekcji: sortowanie „po stanie" bez werdyktów
   * ustawiłoby wszystkie obserwatory w jednym worku „brak danych" i wyglądałoby jak wynik oceny,
   * którego nikt nie zamawiał. Zamiast tego zostaje kolejność dodania, a sterowanie układem jest
   * nieaktywne z podpowiedzią, czego brakuje.
   */
  const oceniono = verdicts !== null && !pending;
  const statusOf = (w: WatcherDTO): WatcherStatus | null =>
    (w.enabled ? verdictById.get(w.id)?.status : null) ?? null;

  function zapisz(patch: { layout?: WatchersLayout }) {
    if (patch.layout !== undefined) setLayout(patch.layout);
    startTransition(async () => {
      try {
        await setWatchersView(patch);
      } catch {
        /* Preferencja układu nie jest danymi użytkownika — nieudany zapis nie może przerwać pracy.
           Widok zostaje w wybranym stanie do końca sesji, wróci do zapisanego po przeładowaniu. */
      }
    });
  }

  /**
   * 085 (AC-22): FILTRA STANÓW JUŻ NIE MA.
   *
   * Chipsy „Spełnione 0 / Częściowo 3 / …" istniały wyłącznie po to, żeby nimi filtrować, a
   * właściciel powiedział wprost: „nie chcemy takiego filtra". Przy okazji znika powód, dla którego
   * pasek łamał się na drugą linię przy 360 px. Liczby stanów nie giną — pokazuje je układ
   * „sekcje", gdzie stoją przy nagłówku swojej grupy, czyli obok rzeczy, których dotyczą.
   */
  const widoczne = watchers;

  const uporzadkowane = oceniono && layout !== "manual" ? poStanie(widoczne, statusOf) : widoczne;
  const sekcje = oceniono && layout === "grouped" ? wSekcje(widoczne, statusOf) : null;

  /**
   * 082: karta obserwatora wydzielona z pętli, bo rysują ją teraz DWIE ścieżki — lista płaska
   * i lista w sekcjach. Powielenie znaczników oznaczałoby, że poprawka w jednej z nich cicho
   * omija drugą. Zwykła funkcja, nie komponent: nie ma własnego stanu, a jako komponent
   * zdefiniowany w ciele `WatchersPanel` byłby przy każdym renderze nowym typem i gubiłby fokus.
   */
  function karta(w: WatcherDTO) {
    const v = verdictById.get(w.id);
    const style = v ? STATUS_STYLE[v.status] : null;
    return (
      <div
        key={w.id}
        className={cn(
          "rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3",
          !w.enabled && "opacity-50",
        )}
      >
        {/* 038: na telefonie tytuł, status i horyzont nie mieszczą się w jednym wierszu —
            tytuł jest osobno i zawija się, a znaczniki idą pod nim. */}
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
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
          <Bell size={18} className="text-[var(--accent-amber)]" /> Obserwatory pogody
        </h2>
        <div className="flex gap-2">
          {/* 085 (AC-18): „Przelicz oceny" wyszło stąd do paska nad listą — ta sama czynność stała
              w dwóch miejscach naraz, a po scaleniu paska drugie byłoby już tylko dubletem. */}
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
          {/**
           * 085 (AC-18, AC-19): JEDEN pasek sterowania NAD listą.
           *
           * Zgłoszenie właściciela: informacja o aktualności oceny i wejście do jej ponowienia stały
           * na samym DOLE, pod całą ścianą obserwatorów, drobnym drukiem — więc o tym, że patrzy się
           * na nieaktualne dane, dowiadywał się na końcu. Teraz układ listy (po lewej) i stan treści
           * AI (po prawej) stoją razem, u góry. Nic nie ubyło: `AiContentMeta` dostaje ten sam komplet
           * propsów, co w bloku, który zniknął ze stopki.
           */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
              {/* Wybór układu ma sens dopiero przy więcej niż jednym obserwatorze — przy jednym
                  trzy przyciski sortowania niczego nie zmieniają (warunek zachowany z 082). */}
              <div className={cn("flex items-center gap-0.5", watchers.length < 2 && "hidden")}>
                {(
                  [
                    { key: "status" as const, Icon: ArrowDownUp, label: t("ukladWgStanu") },
                    { key: "grouped" as const, Icon: Rows3, label: t("ukladSekcje") },
                    { key: "manual" as const, Icon: ListFilter, label: t("ukladKolejnosc") },
                  ]
                ).map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => zapisz({ layout: key })}
                    disabled={!oceniono && key !== "manual"}
                    aria-pressed={layout === key}
                    title={oceniono || key === "manual" ? label : t("najpierwOcen")}
                    aria-label={label}
                    className={cn(
                      "rounded-md border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      layout === key
                        ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>

              {/* Stan treści AI po prawej — ten sam komponent, co w pozostałych sekcjach AI. */}
              <div className="ml-auto min-w-0">
                <AiContentMeta
                  generatedAt={generatedAt}
                  stale={stale}
                  busy={loading}
                  onRefresh={() => evaluate(true)}
                  refreshLabel={t("przeanalizujNaNowo")}
                  staleHint={t("prognozaAlboObserwatoryZmienily")}
                  usage={usage}
                  swiezy={!zPamieci}
                  sectionKind="weather.watchers"
                  mode={mode}
                  onModeChange={setMode}
                />
              </div>
          </div>

          {sekcje
            ? sekcje.map((g) => (
                <div key={g.status ?? "brak"} className="space-y-2">
                  <div className="flex items-center gap-2 pt-1">
                    {g.status && (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: STATUS_STYLE[g.status].color }}
                      />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {g.status ? STATUS_STYLE[g.status].label : t("bezOceny")}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{g.pozycje.length}</span>
                  </div>
                  {g.pozycje.map((w) => karta(w))}
                </div>
              ))
            : uporzadkowane.map((w) => karta(w))}
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
