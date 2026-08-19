"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useViewState } from "@/hooks/useViewState";
import { oneOf, type RawParams } from "@/platform/viewState/viewState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Library,
  Ban,
  RotateCcw,
  Star,
  Trash2,
  MapPin,
  ListPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/home/PageHeader";
import { pageContainerStyle, pageInnerStyle } from "@/components/ui/home/styles";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import { AiCostBadge, type AiCostUsage } from "@/components/ui/AiCostBadge";
import { ModuleView } from "@/components/ui/view";
import { IDEA_CATEGORY_LABELS, IDEA_STATE_LABELS, type IdeaDTO, type IdeaState } from "../lib/ideas";
import { getIdeaDetail, setIdeaState, deleteIdea, addIdeaToTasks } from "../actions/weather";

type Filter = IdeaState | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "saved", label: "Zapisane" },
  { key: "considered", label: "Rozważane" },
  { key: "blocked", label: "Zablokowane" },
];

/**
 * 037: biblioteka pomysłów — wszystko, co użytkownik kiedykolwiek rozważał albo odrzucił.
 *
 * Powód istnienia: plan wygenerowany dziś często przydaje się dopiero za tydzień. Bez tego miejsca
 * jedyną drogą powrotu byłoby wylosowanie tej samej propozycji drugi raz — czyli przypadek.
 */
export function IdeaLibraryPage({
  ideas,
  usdPlnRate,
  canAddToTasks,
  initialIdeaId,
  viewParams = {},
}: {
  ideas: IdeaDTO[];
  usdPlnRate?: number;
  canAddToTasks: boolean;
  /** Id z adresu (`?idea=`) — wejście z zadania utworzonego przyciskiem „Dodaj do zadań". */
  initialIdeaId?: string;
  /** 043: parametry adresu z serwera — filtr czytamy stąd, nie z `window`. */
  viewParams?: RawParams;
}) {
  const t = useTranslations("modules.weather.IdeaLibraryPage");
  const router = useRouter();
  const { showToast } = useToast();
  // 043: filtr stanu pomysłu w adresie (AC-8a).
  const viewSpec = useMemo(() => ({ filter: oneOf(["all", "considered", "saved", "blocked"] as const, "all") }), []);
  const [view, setView] = useViewState(viewSpec, viewParams);
  const filter = view.filter as Filter;
  const setFilter = useCallback((value: Filter) => setView({ filter: value }), [setView]);
  const [location, setLocation] = useState<string>("all");
  const [, startTransition] = useTransition();

  const locations = useMemo(
    () => Array.from(new Set(ideas.map((i) => i.locationLabel).filter(Boolean))).sort(),
    [ideas]
  );

  const visible = ideas.filter(
    (i) => (filter === "all" || i.state === filter) && (location === "all" || i.locationLabel === location)
  );

  function run(fn: () => Promise<void>, ok?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (ok) showToast(ok, "success");
        router.refresh();
      } catch (e: any) {
        showToast(e?.message ?? "Błąd", "error");
      }
    });
  }

  return (
    /* 038: strona korzysta z tych samych elementów układu co pozostałe podstrony działów
       (`pageContainerStyle` + `pageInnerStyle` + `PageHeader`), zamiast własnego nagłówka —
       właściciel słusznie zauważył, że odstawała stylistycznie od reszty aplikacji. */
    <ModuleView
      width="narrow"
      state="ready"
      breadcrumb={
        <Link
      href="/pogoda"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12,
        color: "var(--text-muted)", textDecoration: "none", marginBottom: -12,
      }}
    >
      <ChevronLeft size={14} /> Pogoda
    </Link>
      }
      icon={<Library size={22} />}
      iconColor="var(--accent-purple)"
      title={t("pomysly")}
      href="/pogoda/pomysly"
      subtitle="Propozycje, które rozważałeś albo odrzuciłeś. Zablokowane nie wrócą w „Co robić?”, dopóki ich nie przywrócisz."
    >

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                filter === f.key
                  ? "border-transparent bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--accent-purple)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {locations.length > 1 && (
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            aria-label="Filtruj po lokalizacji"
            className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="all">Wszystkie lokalizacje</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-sm text-[var(--text-muted)]">
          {ideas.length === 0
            ? "Nic tu jeszcze nie ma. Otwórz szczegóły propozycji w sekcji „Co robić?” albo odrzuć taką, której nie chcesz widzieć — trafi tutaj."
            : "Brak pozycji dla wybranych filtrów."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((idea) => (
            <LibraryRow
              key={idea.id ?? idea.fingerprint}
              idea={idea}
              usdPlnRate={usdPlnRate}
              canAddToTasks={canAddToTasks}
              defaultOpen={!!initialIdeaId && idea.id === initialIdeaId}
              onState={(state) => run(() => setIdeaState(idea.id!, state))}
              onDelete={() => run(() => deleteIdea(idea.id!), "Przeniesiono do kosza")}
              onAddToTasks={() => run(() => addIdeaToTasks(idea.id!), "Dodano do zadań")}
            />
          ))}
        </div>
      )}
    </ModuleView>
  );
}

function LibraryRow({
  idea,
  usdPlnRate,
  canAddToTasks,
  defaultOpen,
  onState,
  onDelete,
  onAddToTasks,
}: {
  idea: IdeaDTO;
  usdPlnRate?: number;
  canAddToTasks: boolean;
  defaultOpen: boolean;
  onState: (state: IdeaState) => void;
  onDelete: () => void;
  onAddToTasks: () => void;
}) {
  const t = useTranslations("modules.weather.IdeaLibraryPage");
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<string | null>(null);
  const [usage, setUsage] = useState<AiCostUsage | undefined>();
  const [loading, setLoading] = useState(false);
  const blocked = idea.state === "blocked";

  // Szczegóły dociągamy dopiero po rozwinięciu — biblioteka może mieć dziesiątki pozycji, a plany
  // są długie. To czysty odczyt z bazy, bez wołania modelu.
  useEffect(() => {
    if (!open || detail !== null || !idea.hasDetail) return;
    setLoading(true);
    getIdeaDetail(idea.fingerprint)
      .then((r) => {
        setDetail(r?.detail ?? "");
        setUsage(r?.usage);
      })
      .catch(() => setDetail(""))
      .finally(() => setLoading(false));
  }, [open, detail, idea.fingerprint, idea.hasDetail]);

  return (
    <div className={cn("rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3", blocked && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-[var(--text-primary)]">{idea.title}</span>
            <span
              className="rounded px-1 py-0.5 text-[10px] text-[var(--text-muted)]"
              style={{ border: "1px solid var(--border)" }}
            >
              {IDEA_STATE_LABELS[idea.state ?? "considered"]}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {IDEA_CATEGORY_LABELS[idea.category]}
            </span>
          </div>
          {idea.summary && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{idea.summary}</p>}
          {idea.locationLabel && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <MapPin size={10} /> {idea.locationLabel}
              {idea.detailRuns > 1 && ` · plan generowany ${idea.detailRuns}×`}
            </p>
          )}
        </div>
        {idea.hasDetail && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="shrink-0 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title={open ? "Zwiń plan" : "Pokaż zapisany plan"}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {open && idea.hasDetail && (
        <div className="mt-2 border-t border-[var(--border)] pt-2">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Loader2 size={12} className="animate-spin" /> {t("wczytujePlan")}
            </p>
          ) : detail ? (
            <>
              <style dangerouslySetInnerHTML={{ __html: MARKDOWN_STYLES }} />
              <div
                className="markdown-body text-sm text-[var(--text-secondary)]"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(detail) }}
              />
              {usage && (
                <div className="mt-2 flex justify-end">
                  <AiCostBadge usage={usage} rate={usdPlnRate} />
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Ta pozycja nie ma zapisanego planu.</p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2">
        {blocked ? (
          <Button size="sm" variant="ghost" className="py-3" onClick={() => onState("considered")}>
            <RotateCcw size={13} /> {t("przywrocProponowanie")}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="py-3"
              onClick={() => onState(idea.state === "saved" ? "considered" : "saved")}
            >
              <Star size={13} /> {idea.state === "saved" ? "Odepnij" : "Zapisz"}
            </Button>
            <Button size="sm" variant="ghost" className="py-3" onClick={() => onState("blocked")}>
              <Ban size={13} /> Nie proponuj
            </Button>
            {canAddToTasks && (
              <Button size="sm" variant="ghost" className="py-3" onClick={onAddToTasks}>
                <ListPlus size={13} /> {t("doZadan")}
              </Button>
            )}
          </>
        )}
        <button
          onClick={onDelete}
          className="ml-auto rounded p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)]"
          title={t("usunTrafiDoKosza")}
          aria-label={`Usuń pomysł: ${idea.title}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
