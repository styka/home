"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Ban,
  Library,
  MapPin,
  Home,
  Mountain,
  Compass,
  Eye,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { AiCostUsage } from "@/components/ui/AiCostBadge";
import { AiContentMeta, AiContentPending } from "@/components/ui/AiContentMeta";
import type { AiSectionMode } from "@/lib/ai/sectionMode";
import { UserFactHypothesisCard } from "@/components/ui/UserFactHypothesisCard";
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
  saveIdeaFromList,
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
  const [memory, setMemory] = useState<{ generatedAt: string; stale: boolean; fromMemory: boolean } | null>(null);
  /**
   * 041: sekcja czeka na kliknięcie, bo tryb zabrania generować przy wejściu na stronę. Stan jest
   * osobny od `ideas === null` (jeszcze nie wczytano) i od `error` (awaria) — te trzy sytuacje
   * wyglądają dla użytkownika zupełnie inaczej.
   */
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<AiSectionMode>("onDemand");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState<IdeaDTO | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [detailRuns, setDetailRuns] = useState(0);
  const [detailUsage, setDetailUsage] = useState<AiCostUsage | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  /** Odcisk aktualnie otwartej propozycji — unieważnia spóźnione odpowiedzi (patrz `openIdea`). */
  const openFingerprintRef = useRef<string | null>(null);

  const load = useCallback(
    (opts?: { force?: boolean }) => {
      if (!date) return;
      setLoading(true);
      setError(null);
      getIdeas(coords.lat, coords.lon, coords.label, { date, part, force: opts?.force })
        .then((r) => {
          setMode(r.mode);
          setPending(r.pending);
          if (r.pending) {
            // Nie zerujemy `ideas` na pustą tablicę — pusta lista znaczy „model nic nie wymyślił",
            // a tu po prostu jeszcze o nic nie pytaliśmy.
            setIdeas(null);
            setListUsage(undefined);
            setMemory(null);
            return;
          }
          setIdeas(r.ideas);
          setListUsage(r.usage);
          setMemory(r.generatedAt ? { generatedAt: r.generatedAt, stale: r.stale, fromMemory: r.fromMemory } : null);
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
    // 040: znacznik „która propozycja jest teraz otwarta". Generowanie planu trwa kilkanaście
    // sekund, a od 040 szczegóły stoją przy kartach, więc klikanie kolejnych propozycji w trakcie
    // jest naturalne. Bez tego guardu spóźniona odpowiedź dla A wpisywała swój opis i swoje `id`
    // pod otwartą już kartę B — a „Zapisz" zapisywałoby wtedy A pod pozorem B.
    openFingerprintRef.current = idea.fingerprint;
    const isStillOpen = () => openFingerprintRef.current === idea.fingerprint;

    getIdeaDetail(idea.fingerprint)
      .then((saved) => {
        if (saved?.detail) {
          if (!isStillOpen()) return null;
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
          // Plan i tak zapisał się w bazie, więc `markConsidered` wykonujemy ZAWSZE — praca modelu
          // nie może przepaść tylko dlatego, że użytkownik w międzyczasie zajrzał gdzie indziej.
          markConsidered(idea.fingerprint, r.id);
          if (!isStillOpen()) return null;
          setDetail(r.detail);
          setDetailRuns(r.detailRuns);
          setDetailUsage(r.usage);
          setOpen((o) => (o ? { ...o, id: r.id, hasDetail: true } : o));
          return null;
        });
      })
      .catch((e) => {
        if (isStillOpen()) showToast(e?.message ?? "Nie udało się otworzyć szczegółów", "error");
      })
      .finally(() => {
        // Spinner gasi tylko ta propozycja, która jest otwarta — inaczej spóźniona odpowiedź dla A
        // pokazywałaby kartę B jako gotową, choć jej treść dopiero leci.
        if (isStillOpen()) setDetailLoading(false);
      });
  }

  /** Zamknięcie szczegółów unieważnia trwające zapytanie — inaczej wróciłoby do zamkniętej karty. */
  function closeIdea() {
    openFingerprintRef.current = null;
    setOpen(null);
    setDetailLoading(false);
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
    // `closeIdea`, a nie `setOpen(null)` — zablokowana propozycja musi też unieważnić trwające
    // zapytanie o swoje szczegóły, inaczej odpowiedź wróciłaby do karty, której już nie ma.
    if (open?.fingerprint === idea.fingerprint) closeIdea();
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

  /**
   * 038: zapis prosto z listy — bez otwierania szczegółów i bez generowania opisu. Opis powstanie
   * dopiero przy pierwszym wejściu w pozycję, na podstawie warunków zapisanych teraz.
   */
  function saveFromList(idea: IdeaDTO) {
    setIdeas((prev) =>
      prev ? prev.map((i) => (i.fingerprint === idea.fingerprint ? { ...i, state: "saved" as const } : i)) : prev
    );
    saveIdeaFromList(
      { title: idea.title, summary: idea.summary, category: idea.category },
      { lat: coords.lat, lon: coords.lon, label: coords.label, date, part }
    )
      .then((r) => {
        setIdeas((prev) =>
          prev ? prev.map((i) => (i.fingerprint === idea.fingerprint ? { ...i, id: r.id } : i)) : prev
        );
        showToast("Zapisano — opis powstanie przy wejściu w szczegóły", "success");
      })
      .catch((e) => {
        showToast(e?.message ?? "Nie udało się zapisać", "error");
        load();
      });
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
        {/* 038: DOKŁADNIE JEDEN przycisk generujący. Wcześniej stały tu obok siebie „Pomysły"
            (odnośnik do biblioteki) i „Wylosuj inne" (generowanie) — oba wyglądały jak przycisk,
            więc trzeba było zgadywać, który tworzy nową treść. */}
        <Button size="sm" variant="secondary" onClick={() => load({ force: true })} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Nowe propozycje
        </Button>
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

      {memory && ideas && ideas.length > 0 && (
        <div className="mb-2">
          <AiContentMeta
            generatedAt={memory.generatedAt}
            stale={memory.stale}
            busy={loading}
            onRefresh={() => load({ force: true })}
            refreshLabel="Nowe propozycje"
            staleHint="Prognoza zmieniła się od czasu wygenerowania tych propozycji"
            usage={listUsage}
            sectionKind="weather.ideas"
            mode={mode}
            onModeChange={setMode}
          />
        </div>
      )}

      {pending ? (
        /* 041: nic nie powstaje samo. To NIE jest awaria ani „brak pomysłów" — dlatego ma własny,
           zachęcający stan zamiast szarego zdania. */
        <AiContentPending
          busy={loading}
          onGenerate={() => load({ force: true })}
          title="Propozycje powstaną po kliknięciu"
          hint="Ta sekcja jest ustawiona na „na żądanie”, więc samo wejście na stronę nic nie kosztuje."
          actionLabel="Zaproponuj, co robić"
          sectionKind="weather.ideas"
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            // Zmiana na tryb generujący ma dać efekt od razu, bez dodatkowego kliknięcia.
            if (m !== "onDemand") load();
          }}
        />
      ) : loading && ideas === null ? (
        <p className="py-4 text-sm text-[var(--text-muted)]">Szukam pomysłów na tę pogodę…</p>
      ) : error ? (
        /* 038: awaria musi WYGLĄDAĆ inaczej niż brak pomysłów. Wcześniej oba stany były jednakowo
           szarym zdaniem, więc nieudane generowanie użytkownik czytał jako „nie ma co robić" i
           ponawiał w nieskończoność. */
        <div className="rounded-lg border border-[var(--accent-amber)] bg-[var(--bg-base)] p-3">
          <p className="mb-2 flex items-start gap-1.5 text-sm text-[var(--text-primary)]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--accent-amber)]" />
            <span>
              <span className="font-medium">Nie udało się przygotować propozycji.</span>{" "}
              <span className="text-[var(--text-secondary)]">{error}</span>
            </span>
          </p>
          <Button size="sm" variant="secondary" className="py-3" onClick={() => load({ force: true })}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : ideas && ideas.length > 0 ? (
        <div className="space-y-2">
          {/* 040: szczegóły rozwijają się PRZY klikniętej propozycji, a nie pod całą listą.
              Wcześniej sheet renderował się na końcu panelu — na desktopie, przy 7 propozycjach,
              wypadał poza ekran, więc kliknięcie wyglądało, jakby nic nie zrobiło. */}
          {ideas.map((idea) => {
            const isOpen = open?.fingerprint === idea.fingerprint;
            return (
              <div key={idea.fingerprint}>
                <IdeaCard
                  idea={idea}
                  expanded={isOpen}
                  onOpen={() => (isOpen ? closeIdea() : openIdea(idea))}
                  onBlock={() => block(idea)}
                  onSave={() => saveFromList(idea)}
                />
                {isOpen && open && (
                  <div className="mt-2">
                    <IdeaDetailSheet
                      idea={open}
                      detail={detail}
                      detailRuns={detailRuns}
                      loading={detailLoading}
                      regenerating={regenerating}
                      usage={detailUsage}
                      usdPlnRate={usdPlnRate}
                      canAddToTasks={canAddToTasks}
                      onClose={closeIdea}
                      onRegenerate={regenerate}
                      onSave={save}
                      onAddToTasks={addToTasks}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-3">
          <p className="mb-2 text-sm text-[var(--text-muted)]">
            Model nie zaproponował nic na tę porę. Spróbuj innego dnia lub pory albo poproś o nowe
            propozycje.
          </p>
          <Button size="sm" variant="secondary" className="py-3" onClick={() => load({ force: true })}>
            Nowe propozycje
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
        <Link
          href="/pogoda/pomysly"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
        >
          <Library size={13} /> Zapisane pomysły →
        </Link>
        {/* 041: licznik kosztu przeniósł się do paska nad listą (`AiContentMeta`). Stał tu osobno,
            w stopce, więc „kiedy powstało" i „ile kosztowało" czytało się w dwóch różnych miejscach
            ekranu — a to jest jedna informacja o tej samej treści. */}
      </div>

      {/* 039: hipoteza o użytkowniku pod listą propozycji — czyli dokładnie tam, gdzie widać, po co
          ona jest. Jedna karta, bez modala i bez blokowania czegokolwiek. */}
      <UserFactHypothesisCard />
    </div>
  );
}

function IdeaCard({
  idea,
  expanded,
  onOpen,
  onBlock,
  onSave,
}: {
  idea: IdeaDTO;
  /** Czy pod tą kartą rozwinięte są szczegóły — karta ma to pokazywać, nie tylko sheet poniżej. */
  expanded: boolean;
  onOpen: () => void;
  onBlock: () => void;
  onSave: () => void;
}) {
  const Icon = CATEGORY_ICON[idea.category];
  return (
    <div
      className="flex items-start gap-2 rounded-lg border bg-[var(--bg-base)] p-3"
      style={{ borderColor: expanded ? "var(--accent-purple)" : "var(--border)" }}
    >
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
          onClick={onSave}
          disabled={idea.state === "saved"}
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-amber)] disabled:opacity-40"
          title={idea.state === "saved" ? "Już zapisana" : "Zapisz na później (bez generowania opisu)"}
          aria-label={`Zapisz: ${idea.title}`}
        >
          <Star size={14} className={idea.state === "saved" ? "fill-[var(--accent-amber)]" : ""} />
        </button>
        <button
          onClick={onBlock}
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)]"
          title="Nie proponuj mi tego"
          aria-label={`Nie proponuj: ${idea.title}`}
        >
          <Ban size={14} />
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
