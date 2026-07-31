"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Shuffle,
  Loader2,
  ChevronRight,
  Ban,
  Library,
  MapPin,
  Home,
  Mountain,
  Compass,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";
import { DAY_PARTS, currentDayPart, type DayPart } from "@/lib/weather/presets";
import type { Forecast } from "@/lib/weather/openMeteo";
import type { IdeaCategory, IdeaDTO } from "@/lib/weather/ideas";
import { IdeaDetailSheet } from "./IdeaDetailSheet";
import {
  getIdeas,
  getIdeaDetail,
  generateIdeaDetail,
  blockIdea,
  setIdeaState,
  addIdeaToTasks,
} from "@/actions/weather";

const CATEGORY_ICON: Record<IdeaCategory, typeof Compass> = {
  outdoor: Mountain,
  trip: Compass,
  home: Home,
  other: Sparkles,
};

/**
 * 037: sekcja „Co robić?" jako LISTA propozycji zamiast jednego akapitu.
 *
 * Każda pozycja da się rozwinąć w szczegółowy plan (trwały, więc wraca po ponownym otwarciu
 * aplikacji) albo odrzucić na zawsze — bez wchodzenia w szczegóły.
 */
export function IdeasPanel({
  forecast,
  coords,
  usdPlnRate,
  canAddToTasks,
}: {
  forecast: Forecast;
  coords: { lat: number; lon: number; label: string };
  usdPlnRate?: number;
  canAddToTasks: boolean;
}) {
  const { showToast } = useToast();
  const [date, setDate] = useState<string>(forecast.daily[0]?.date ?? "");
  const [part, setPart] = useState<DayPart>(() => currentDayPart());
  const [ideas, setIdeas] = useState<IdeaDTO[] | null>(null);
  const [listUsage, setListUsage] = useState<AiCostUsage | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState<IdeaDTO | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [detailRuns, setDetailRuns] = useState(0);
  const [detailUsage, setDetailUsage] = useState<AiCostUsage | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(
    (opts?: { variation?: boolean }) => {
      if (!date) return;
      setLoading(true);
      setError(null);
      getIdeas(coords.lat, coords.lon, coords.label, { date, part, variation: opts?.variation })
        .then((r) => {
          setIdeas(r.ideas);
          setListUsage(r.usage);
        })
        .catch((e) => {
          setIdeas(null);
          setError(e?.message ?? "Nie udało się przygotować propozycji.");
        })
        .finally(() => setLoading(false));
    },
    [coords.lat, coords.lon, coords.label, date, part]
  );

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Otwarcie propozycji: najpierw pytamy o ZAPISANY plan i tylko przy jego braku wołamy model.
   * To jest cała mechanika „wracam do tego jutro i nie płacę drugi raz".
   */
  function openIdea(idea: IdeaDTO) {
    setOpen(idea);
    setDetail(null);
    setDetailUsage(undefined);
    setDetailRuns(0);
    setDetailLoading(true);
    getIdeaDetail(idea.fingerprint)
      .then((saved) => {
        if (saved?.detail) {
          setDetail(saved.detail);
          setDetailRuns(saved.detailRuns);
          setDetailUsage(saved.usage);
          setOpen((o) => (o ? { ...o, id: saved.id, hasDetail: true } : o));
          return null;
        }
        return generateIdeaDetail(
          { title: idea.title, summary: idea.summary, category: idea.category },
          { lat: coords.lat, lon: coords.lon, label: coords.label, date, part }
        ).then((r) => {
          setDetail(r.detail);
          setDetailRuns(r.detailRuns);
          setDetailUsage(r.usage);
          setOpen((o) => (o ? { ...o, id: r.id, hasDetail: true } : o));
          markConsidered(idea.fingerprint, r.id);
          return null;
        });
      })
      .catch((e) => showToast(e?.message ?? "Nie udało się otworzyć szczegółów", "error"))
      .finally(() => setDetailLoading(false));
  }

  function regenerate() {
    if (!open) return;
    setRegenerating(true);
    generateIdeaDetail(
      { title: open.title, summary: open.summary, category: open.category },
      { lat: coords.lat, lon: coords.lon, label: coords.label, date, part },
      { force: true }
    )
      .then((r) => {
        setDetail(r.detail);
        setDetailRuns(r.detailRuns);
        setDetailUsage(r.usage);
        setOpen((o) => (o ? { ...o, id: r.id, hasDetail: true } : o));
      })
      .catch((e) => showToast(e?.message ?? "Nie udało się wygenerować planu", "error"))
      .finally(() => setRegenerating(false));
  }

  /** Po pierwszej generacji propozycja ma już wiersz w bazie — oznaczamy ją jako rozważaną. */
  function markConsidered(fingerprint: string, id: string) {
    setIdeas((prev) =>
      prev
        ? prev.map((i) =>
            i.fingerprint === fingerprint ? { ...i, id, hasDetail: true, state: "considered" as const } : i
          )
        : prev
    );
  }

  function block(idea: IdeaDTO) {
    // Znika z listy od razu — czekanie na serwer sprawiałoby wrażenie, że kliknięcie nie zadziałało.
    setIdeas((prev) => (prev ? prev.filter((i) => i.fingerprint !== idea.fingerprint) : prev));
    if (open?.fingerprint === idea.fingerprint) setOpen(null);
    blockIdea(
      { title: idea.title, summary: idea.summary, category: idea.category },
      { label: coords.label, lat: coords.lat, lon: coords.lon }
    )
      .then(() => showToast("Nie będziemy tego proponować", "success"))
      .catch((e) => {
        showToast(e?.message ?? "Nie udało się zablokować", "error");
        load();
      });
  }

  /**
   * Zapis do biblioteki. Wiersz w bazie powstaje przy pierwszej generacji szczegółów, więc jego id
   * jest już znane z otwarcia propozycji — nie ma potrzeby dociągania go osobną rundą.
   */
  function save() {
    if (!open?.id) return;
    const target = open;
    setIdeaState(target.id!, "saved")
      .then(() => {
        setOpen({ ...target, state: "saved" });
        setIdeas((prev) =>
          prev
            ? prev.map((i) => (i.fingerprint === target.fingerprint ? { ...i, id: target.id, state: "saved" } : i))
            : prev
        );
        showToast("Zapisano w bibliotece pomysłów", "success");
      })
      .catch((e) => showToast(e?.message ?? "Nie udało się zapisać", "error"));
  }

  function addToTasks() {
    if (!open?.id) return;
    addIdeaToTasks(open.id)
      .then(() => showToast("Dodano do zadań", "success"))
      .catch((e) => showToast(e?.message ?? "Nie udało się dodać zadania", "error"));
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <Sparkles size={15} className="text-[var(--accent-purple)]" /> Co robić?
        </h3>
        <div className="flex items-center gap-2">
          <Link
            href="/pogoda/pomysly"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Library size={13} /> Pomysły
          </Link>
          <Button size="sm" variant="secondary" onClick={() => load({ variation: true })} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
            Wylosuj inne
          </Button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {forecast.daily.map((d, i) => (
          <Chip
            key={d.date}
            active={date === d.date}
            label={i === 0 ? "Dziś" : i === 1 ? "Jutro" : weekdayShort(d.date)}
            onClick={() => setDate(d.date)}
          />
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {DAY_PARTS.map((p) => (
          <Chip key={p.key} active={part === p.key} label={p.label} onClick={() => setPart(p.key)} />
        ))}
      </div>

      {loading && ideas === null ? (
        <p className="py-4 text-sm text-[var(--text-muted)]">Szukam pomysłów na tę pogodę…</p>
      ) : error ? (
        <div className="py-3">
          <p className="mb-2 text-sm text-[var(--text-muted)]">{error}</p>
          <Button size="sm" variant="secondary" className="py-3" onClick={() => load()}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : ideas && ideas.length > 0 ? (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <IdeaCard key={idea.fingerprint} idea={idea} onOpen={() => openIdea(idea)} onBlock={() => block(idea)} />
          ))}
        </div>
      ) : (
        <div className="py-3">
          <p className="mb-2 text-sm text-[var(--text-muted)]">
            Brak propozycji na tę porę. Spróbuj innego dnia albo wylosuj inne pomysły.
          </p>
          <Button size="sm" variant="secondary" className="py-3" onClick={() => load()}>
            Spróbuj ponownie
          </Button>
        </div>
      )}

      {listUsage && (
        <div className="mt-3 flex justify-end border-t border-[var(--border)] pt-2">
          <AiCostBadge usage={listUsage} rate={usdPlnRate} />
        </div>
      )}

      {open && (
        <div className="mt-3">
          <IdeaDetailSheet
            idea={open}
            detail={detail}
            detailRuns={detailRuns}
            loading={detailLoading}
            regenerating={regenerating}
            usage={detailUsage}
            usdPlnRate={usdPlnRate}
            canAddToTasks={canAddToTasks}
            onClose={() => setOpen(null)}
            onRegenerate={regenerate}
            onSave={save}
            onAddToTasks={addToTasks}
          />
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  onOpen,
  onBlock,
}: {
  idea: IdeaDTO;
  onOpen: () => void;
  onBlock: () => void;
}) {
  const Icon = CATEGORY_ICON[idea.category];
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-[var(--accent-purple)]" />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--text-primary)]">{idea.title}</span>
          {idea.nearby && (
            <span
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-[var(--accent-green)]"
              style={{ border: "1px solid var(--accent-green)" }}
              title="Propozycja związana z konkretnym miejscem w okolicy"
            >
              <MapPin size={9} /> w okolicy
            </span>
          )}
          {idea.hasDetail && (
            <span
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-[var(--text-muted)]"
              style={{ border: "1px solid var(--border)" }}
              title="Oglądałeś już szczegóły tej propozycji"
            >
              <Eye size={9} /> już rozważana
            </span>
          )}
        </span>
        {idea.summary && (
          <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{idea.summary}</span>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onBlock}
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)]"
          title="Nie proponuj mi tego"
          aria-label={`Nie proponuj: ${idea.title}`}
        >
          <Ban size={14} />
        </button>
        <button
          onClick={onOpen}
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Pokaż szczegółowy plan"
          aria-label={`Szczegóły: ${idea.title}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
        active
          ? "border-transparent bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--accent-purple)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
      )}
    >
      {label}
    </button>
  );
}

function weekdayShort(dateIso: string): string {
  return new Date(dateIso + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "short" });
}
