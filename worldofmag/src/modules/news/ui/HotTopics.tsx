"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Plus, Loader2, EyeOff, Undo2, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { AiContentMeta, AiContentPending } from "@/components/ui/AiContentMeta";
import { NaglowekSekcji } from "./sekcjeTematow";
import {
  getHotTopics,
  createTopic,
  hideHotTopic,
  unhideHotTopic,
  getHiddenTopics,
  type HotTopic,
  type HotTopicsResult,
  deleteTopic,
  type HiddenTopicDTO,
  type TopicDTO,
} from "../actions/news";

/** `onTopicsChanged` odświeża listę tematów w module — bez zmiany widoku (040). */
export function HotTopics({
  monitorowane,
  onTopicsChanged,
}: {
  /** 084 (AC-27): tematy monitorowane — żeby dało się nimi zarządzać STĄD, a nie tylko z listy. */
  monitorowane: TopicDTO[];
  onTopicsChanged: () => void;
}) {
  const t = useTranslations("modules.news.HotTopics");
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const [data, setData] = useState<HotTopicsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [hidden, setHidden] = useState<HiddenTopicDTO[] | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [showMonitorowane, setShowMonitorowane] = useState(false);
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

  /**
   * 084 (AC-27): przestań monitorować — z tej samej zakładki, w której temat się pojawił.
   *
   * Do 083 dodanie tematu z propozycji było jednokierunkowe: żeby je cofnąć, trzeba było przejść do
   * listy wiadomości i tam znaleźć jego sekcję. Skoro propozycję dodaje się stąd, stąd też musi dać
   * się ją wycofać.
   */
  async function przestanMonitorowac(temat: TopicDTO) {
    if (!(await confirmDialog(`Przestać monitorować temat „${temat.title}" i usunąć jego linię czasu?`))) return;
    startBusy(async () => {
      try {
        await deleteTopic(temat.id);
        onTopicsChanged();
        // 084 (recenzja): BEZ `force`. Zdjęcie tematu z monitorowanych zmienia tylko to, co odsiewamy
        // z zapamiętanej listy — nie jest prośbą o nową analizę, a `force` kosztowałby wywołanie modelu
        // przy każdym takim kliknięciu (C-53 i reguła „regeneracja tylko na jawne żądanie", 038).
        load();
      } catch (e: any) {
        showToast(e.message ?? "Nie udało się usunąć tematu", "error");
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
      {/* 083 (AC-28): TEN SAM przyklejony nagłówek sekcji, co w wiadomościach, na osi czasu i w
          zakładce Źródeł. Właściciel prosił o spójność trzech zakładek wprost — a spójność, która
          bierze się ze wspólnego komponentu, nie rozjeżdża się przy pierwszej zmianie stylu; taka,
          która bierze się z podobnie wyglądającego, skopiowanego JSX-a, rozjeżdża się zawsze. */}
      <NaglowekSekcji
        tytul={t("goraceTematy")}
        licznik={topics.length}
        akcje={
          <div className="flex shrink-0 items-center gap-1">
            {monitorowane.length > 0 && (
              <button
                onClick={() => setShowMonitorowane((v) => !v)}
                aria-expanded={showMonitorowane}
                className="shrink-0 rounded-md px-2 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                {t("monitorowane")} ({monitorowane.length})
              </button>
            )}
            {(hidden?.length ?? 0) > 0 && (
              <button
                onClick={() => setShowHidden((v) => !v)}
                aria-expanded={showHidden}
                className="shrink-0 rounded-md px-2 py-2 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                {t("odrzucone")} ({hidden!.length})
              </button>
            )}
          </div>
        }
      />
      <p className="mb-2 mt-2 text-xs text-[var(--text-muted)]">{t("ostatnie24hWszystkieZrodla")}</p>

      {/* 041: koszt stoi WEWNĄTRZ paska, a nie obok — to jedna informacja o tej samej treści.
          Przy stanie oczekiwania pasek się nie pokazuje: nie ma jeszcze czego opisywać. */}
      {!data?.pending && (
        <div className="mb-4">
          <AiContentMeta
            generatedAt={data?.generatedAt ?? undefined}
            stale={data?.stale}
            busy={loading}
            onRefresh={() => load(true)}
            refreshLabel="Przeanalizuj na nowo"
            staleHint="Od czasu tej analizy przybyło świeżych materiałów"
            usage={data?.usage}
            swiezy={data?.fromMemory === false}
            sectionKind="news.hotTopics"
            mode={data?.mode}
            onModeChange={() => load()}
          />
        </div>
      )}

      {showMonitorowane && monitorowane.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <p className="mb-2 text-xs text-[var(--text-muted)]">{t("tematyKtoreMonitorujesz")}</p>
          <ul className="space-y-2">
            {monitorowane.map((temat) => (
              <li key={temat.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 text-sm text-[var(--text-primary)]">{temat.title}</span>
                <Button variant="ghost" size="sm" onClick={() => przestanMonitorowac(temat)} disabled={busy}>
                  <Trash2 size={14} /> {t("przestanMonitorowac")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showHidden && hidden && hidden.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            {t("teTematyNieBeda")}
          </p>
          <ul className="space-y-2">
            {hidden.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-[var(--text-primary)]">{h.title}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => unhide(h, false)} disabled={busy}>
                    <Undo2 size={14} /> {t("przywroc")}
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
          <span className="text-sm">{t("analizujeNaglowkiZOstatnich")}</span>
        </div>
      ) : failed ? (
        <div className="rounded-lg border border-[var(--accent-red)] bg-[var(--bg-surface)] p-4 text-sm">
          <p className="text-[var(--text-primary)]">{t("nieUdaloSiePrzygotowac")}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{failed}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => load(true)}>
            {t("sprobujPonownie")}
          </Button>
        </div>
      ) : data?.pending ? (
        /* 041: analiza nie rusza sama. To NIE jest „brak materiałów" ani awaria — obie te sytuacje
           mają obok własne, wyraźnie inne komunikaty. */
        <AiContentPending
          busy={loading}
          onGenerate={() => load(true)}
          title={t("goraceTematyPowstanaPo")}
          hint="Ta sekcja jest ustawiona na „na żądanie”, więc wejście na zakładkę nic nie kosztuje."
          actionLabel="Przeanalizuj nagłówki"
          sectionKind="news.hotTopics"
          mode={data.mode}
          // Po zmianie trybu czytamy jeszcze raz — „zawsze świeże" da wtedy treść od ręki, a
          // pozostałe tryby zostaną przy oczekiwaniu, bo pierwsza treść wymaga decyzji.
          onModeChange={() => load()}
        />
      ) : topics.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          {t("brakSwiezychMaterialowDo")}
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
