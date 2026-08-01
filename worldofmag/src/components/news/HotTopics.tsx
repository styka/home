"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Flame, Plus, Loader2, EyeOff, Undo2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AiContentMeta } from "@/components/ui/AiContentMeta";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import {
  getHotTopics,
  createTopic,
  hideHotTopic,
  unhideHotTopic,
  getHiddenTopics,
  type HotTopic,
  type HotTopicsResult,
  type HiddenTopicDTO,
} from "@/actions/news";

/** `onTopicsChanged` odświeża listę tematów w module — bez zmiany widoku (040). */
export function HotTopics({ onTopicsChanged }: { onTopicsChanged: () => void }) {
  const { showToast } = useToast();
  const [data, setData] = useState<HotTopicsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [hidden, setHidden] = useState<HiddenTopicDTO[] | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  // Odciski tematów oznaczonych jako monitorowane w TEJ sesji przeglądu.
  const [monitored, setMonitored] = useState<Set<string>>(new Set());
  const [busy, startBusy] = useTransition();

  // 038: `force` tylko z jawnego kliknięcia. Samo wejście na widok czyta zapamiętaną listę —
  // inaczej każde otwarcie zakładki kosztowałoby jedno wywołanie modelu.
  const load = useCallback(
    (force?: boolean) => {
      setLoading(true);
      setFailed(null);
      getHotTopics(force)
        .then(setData)
        .catch((e) => {
          // Awaria i „brak tematów" to dwa różne komunikaty — mylenie ich każe użytkownikowi
          // ponawiać bez sensu (lekcja z 038).
          setFailed(e?.message ?? "Nie udało się pobrać gorących tematów");
        })
        .finally(() => setLoading(false));
    },
    []
  );

  const loadHidden = useCallback(() => {
    getHiddenTopics()
      .then(setHidden)
      .catch(() => setHidden([]));
  }, []);

  useEffect(() => {
    load();
    loadHidden();
  }, [load, loadHidden]);

  /**
   * 040: dodanie tematu do monitorowanych **nie opuszcza listy**.
   *
   * Wcześniej `onAdded()` przerzucało na widok główny po pierwszym kliknięciu — a przeglądanie
   * gorących tematów polega właśnie na tym, żeby przejść całą listę i pooznaczać pozycje (monitoruj
   * / nie proponuj). Wyrzucanie po każdym oznaczeniu zamieniało jedną sesję przeglądu w tyle
   * powrotów, ile tematów.
   */
  function add(t: HotTopic) {
    startBusy(async () => {
      try {
        await createTopic({ title: t.title, semanticFilter: t.suggestedFilter });
        showToast(`Dodano „${t.title}” do monitorowanych`, "success");
        // Karta zostaje na liście, ale wie już, że jest obsłużona — bez tego jedynym śladem po
        // kliknięciu byłby znikający komunikat.
        setMonitored((prev) => new Set(prev).add(t.fingerprint));
        // Lista tematów w module jest teraz nieaktualna; odświeżamy ją BEZ zmiany widoku.
        onTopicsChanged();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  function hide(t: HotTopic) {
    startBusy(async () => {
      try {
        await hideHotTopic(t.title);
        // Odrzucenie filtrujemy lokalnie, bez ponownego pytania modelu — lista w pamięci jest ta
        // sama, zmienia się tylko to, co z niej pokazujemy.
        setData((prev) =>
          prev ? { ...prev, topics: prev.topics.filter((x) => x.fingerprint !== t.fingerprint) } : prev
        );
        loadHidden();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  function unhide(h: HiddenTopicDTO, monitor: boolean) {
    startBusy(async () => {
      try {
        await unhideHotTopic(h.id);
        if (monitor) {
          await createTopic({ title: h.title, semanticFilter: h.title });
          showToast(`Dodano „${h.title}” do monitorowanych`, "success");
          onTopicsChanged();
        }
        loadHidden();
        load();
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  const topics = data?.topics ?? [];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-[var(--accent-amber)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Gorące tematy</h2>
          <span className="text-xs text-[var(--text-muted)]">ostatnie 24h · wszystkie źródła</span>
        </div>
        {(hidden?.length ?? 0) > 0 && (
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="text-xs text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
          >
            Odrzucone tematy ({hidden!.length})
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <AiContentMeta
          generatedAt={data?.generatedAt ?? undefined}
          stale={data?.stale}
          busy={loading}
          onRefresh={() => load(true)}
          refreshLabel="Przeanalizuj na nowo"
          staleHint="Od czasu tej analizy przybyło świeżych materiałów"
        />
        <AiCostBadge usage={data?.usage} align="left" />
      </div>

      {showHidden && hidden && hidden.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Te tematy nie będą proponowane. Możesz je przywrócić na listę propozycji albo od razu
            zacząć monitorować.
          </p>
          <ul className="space-y-2">
            {hidden.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-[var(--text-primary)]">{h.title}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => unhide(h, false)} disabled={busy}>
                    <Undo2 size={14} /> Przywróć
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => unhide(h, true)} disabled={busy}>
                    <Plus size={14} /> Monitoruj
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && data === null ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-muted)]">
          <Loader2 className="animate-spin" />
          <span className="text-sm">Analizuję nagłówki z ostatnich 24 godzin…</span>
        </div>
      ) : failed ? (
        <div className="rounded-lg border border-[var(--accent-red)] bg-[var(--bg-surface)] p-4 text-sm">
          <p className="text-[var(--text-primary)]">Nie udało się przygotować gorących tematów.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{failed}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => load(true)}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : topics.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          Brak świeżych materiałów do analizy. Odśwież wiadomości, żeby napełnić pulę, albo sprawdź
          źródła w ustawieniach.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {topics.map((t) => (
            <div
              key={t.fingerprint}
              className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4"
            >
              <h3 className="font-semibold text-[var(--text-primary)]">{t.title}</h3>
              <p className="mt-1 flex-1 text-sm text-[var(--text-secondary)]">{t.summary}</p>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                Źródła: {t.sources?.join(", ") || "—"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {monitored.has(t.fingerprint) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--accent-green)]">
                    <Check size={14} /> Monitorowany
                  </span>
                ) : (
                  <Button size="sm" onClick={() => add(t)} disabled={busy}>
                    <Plus size={14} /> Monitoruj ten temat
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => hide(t)} disabled={busy}>
                  <EyeOff size={14} /> Nie proponuj
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
