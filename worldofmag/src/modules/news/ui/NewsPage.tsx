"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useViewState } from "@/hooks/useViewState";
import { idList, oneOf, text, type RawParams } from "@/platform/viewState/viewState";
import { useRouter } from "next/navigation";
import { Newspaper, RefreshCw, Flame, Settings2, Plus, Loader2, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import { zglosKoszt } from "@/platform/ai/kosztBus";
import { ModuleView } from "@/components/ui/view";
import {
  GroupNavigator,
  WSZYSTKIE,
  pozycjeNawigatora,
  sasiadujacaGrupa,
  type GrupaNawigatora,
} from "@/components/ui/nav/GroupNavigator";
import { NewsStream } from "./NewsStream";
import { NewsTimelineStream } from "./NewsTimelineStream";
import { HotTopics } from "./HotTopics";
import { NewsSettings } from "./NewsSettings";
import { SourceFilter } from "./SourceFilter";
import { useSekcjeTematow, przewinDoSekcji, PROGRAMOWE_PRZEWIJANIE_MS } from "./sekcjeTematow";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { getAssistantPrefs, updateAssistantPrefs } from "@/actions/assistantPrefs";
import {
  getStreamView,
  getStreamTimeline,
  type StreamTopicDTO,
  type StreamTimelineTopicDTO,
  startNewsRefresh,
  getNewsRefreshState,
  createTopic,
  updateTopic,
  deleteTopic,
  type TopicDTO,
  type SourceDTO,
  type SummaryLength,
  type NewsRefreshState,
} from "../actions/news";

type View = "feed" | "hot" | "settings";
/** 040/083: co pokazujemy — nowe wiadomości (domyślnie) albo linię czasu. Union TS, nie enum (C-12). */
type ContentKey = "items" | "timeline";

/** Gest w bok liczy się od tylu pikseli i musi być tyle razy bardziej poziomy niż pionowy. */
const SWIPE_MIN_PX = 40;
const SWIPE_DOMINANCE = 1.2;
/** Ile pikseli i jak długo trwa przesunięcie treści przy zmianie tematu (AC-19). */
const PRZESUW_PX = 24;
const PRZESUW_MS = 180;

export function NewsPage({
  topics,
  sources,
  defaultLength,
  viewParams = {},
}: {
  topics: TopicDTO[];
  sources: SourceDTO[];
  defaultLength: SummaryLength;
  /** 043: parametry adresu z serwera — stan widoku czytamy stąd, nie z `window`. */
  viewParams?: RawParams;
}) {
  const t = useTranslations("modules.news.NewsPage");
  const router = useRouter();
  const { showToast } = useToast();

  /**
   * 043/083: cały stan widoku w ADRESIE — zakładka, wybrany temat, rodzaj treści i wybrane portale.
   *
   * To nie jest ozdoba: gwiazdka „zapisz ten widok" bierze adres, więc filtr trzymany w pamięci
   * komponentu (albo w bazie, jak było ze źródłem do 082) dawałby ulubione, które po powrocie
   * pokazuje coś innego niż w chwili zapisu.
   */
  const viewSpec = useMemo(
    () => ({
      widok: oneOf(["feed", "hot", "settings"] as const, "feed"),
      temat: text(WSZYSTKIE),
      tresc: oneOf(["items", "timeline"] as const, "items"),
      zrodla: idList(),
    }),
    []
  );
  const [viewState, setViewState] = useViewState(viewSpec, viewParams);
  const view = viewState.widok;
  const setView = useCallback((value: View) => setViewState({ widok: value }), [setViewState]);
  const wybranyTemat = viewState.temat;
  const tresc = viewState.tresc;
  const wybraneZrodla = viewState.zrodla;

  /**
   * 083: temat CZYTANY to co innego niż temat WYBRANY.
   *
   * Wybrany (`wybranyTemat`, w adresie) jest filtrem — decyduje, co w ogóle jest na liście.
   * Czytany (tutaj, w pamięci) wynika z przewijania i służy WYŁĄCZNIE do podświetlenia nagłówka
   * sekcji. Zgłoszenie właściciela po 082 brzmiało dokładnie o to: „podwójnie mamy bieżący temat,
   * ten jako input i ten ładny" — więc pasek nawigacji nie pokazuje już nazwy tematu czytanego,
   * a nazwa tematu stoi tam, gdzie jego treść.
   */
  const [czytanyTemat, setCzytanyTemat] = useState<string | null>(null);

  /**
   * 084 (AC-6, AC-7): PODĄŻANIE ZA CZYTANYM TEKSTEM — jeden stan na cały widok.
   *
   * Mieszka tutaj, a nie w lektorze, bo ma dwa wejścia (pasek lektora i nagłówek sekcji) i jedno
   * wyjście: samoczynne wyłączenie, gdy użytkownik przewinie widok SAM. Dwa stany dałyby sytuację,
   * w której przełącznik pokazuje co innego niż robi widok.
   */
  const [podazanie, setPodazanie] = useState(true);
  const zmienPodazanie = useCallback((wlaczone: boolean) => {
    setPodazanie(wlaczone);
    void updateAssistantPrefs({ readerFollow: wlaczone }).catch(() => {});
  }, []);

  useEffect(() => {
    getAssistantPrefs()
      .then((p) => setPodazanie(p.readerFollow))
      .catch(() => {});
  }, []);

  const [stream, setStream] = useState<StreamTopicDTO[] | null>(null);
  const [timeline, setTimeline] = useState<StreamTimelineTopicDTO[] | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [refresh, setRefresh] = useState<NewsRefreshState | null>(null);
  const [starting, startRefreshing] = useTransition();
  const [editing, setEditing] = useState<TopicDTO | null>(null);
  const [creating, setCreating] = useState(false);

  /** Rama przewijania widoku — jedyny element, którym wolno przewijać (lekcja z 082). */
  const ramaRef = useRef<HTMLDivElement>(null);

  /**
   * 082 (poprawka): wysokość PRZYKLEJONEGO paska nawigacji, mierzona, a nie wpisana na sztywno.
   *
   * Potrzebują jej trzy rzeczy naraz: przyklejony nagłówek sekcji (musi stanąć POD paskiem),
   * margines celu przewijania i obserwator wyznaczający temat czytany. Mierzymy, bo skórki Omnii
   * zmieniają typografię i gęstość — wpisana liczba byłaby prawdziwa dla jednej skórki.
   */
  const pasekRef = useRef<HTMLDivElement>(null);
  const [pasekH, setPasekH] = useState(0);

  const enabledSources = useMemo(() => sources.filter((s) => s.enabled), [sources]);

  // ── Odczyty ───────────────────────────────────────────────────────────────
  const loadStream = useCallback(() => {
    setLoadingStream(true);
    getStreamView()
      .then(setStream)
      .catch(() => setStream([]))
      .finally(() => setLoadingStream(false));
  }, []);

  const loadTimeline = useCallback(() => {
    setLoadingTimeline(true);
    getStreamTimeline()
      .then(setTimeline)
      .catch(() => setTimeline([]))
      .finally(() => setLoadingTimeline(false));
  }, []);

  useEffect(() => {
    if (view === "feed" && tresc === "items") loadStream();
  }, [view, tresc, loadStream]);

  useEffect(() => {
    // Oś czasu czytamy dopiero, gdy jest na ekranie — to osobne, niemałe zapytanie.
    if (view === "feed" && tresc === "timeline") loadTimeline();
  }, [view, tresc, loadTimeline]);

  // Temat usunięty gdzie indziej nie może zostać jako filtr — inaczej widok jest pusty bez powodu.
  useEffect(() => {
    if (wybranyTemat !== WSZYSTKIE && !topics.some((x) => x.id === wybranyTemat)) {
      setViewState({ temat: WSZYSTKIE });
    }
  }, [topics, wybranyTemat, setViewState]);

  // ── Stan przebiegu odświeżania ────────────────────────────────────────────
  // 039: czytamy z KOLEJKI, nie z pamięci komponentu — powrót na stronę pokazuje trwający przebieg.
  const refreshRunning = refresh?.status === "QUEUED" || refresh?.status === "RUNNING";

  const loadRefreshState = useCallback(() => {
    getNewsRefreshState()
      .then(setRefresh)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRefreshState();
  }, [loadRefreshState]);

  useEffect(() => {
    if (!refreshRunning) return;
    const id = setInterval(loadRefreshState, 2000);
    return () => clearInterval(id);
  }, [refreshRunning, loadRefreshState]);

  const wasRunning = useRef(false);
  useEffect(() => {
    if (refreshRunning) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;

    const r = refresh?.result;
    // 083 (recenzja): koszt przebiegu melduje się DOKŁADNIE TU — w chwili jego domknięcia — a nie
    // z renderu `RefreshStatus`. Tamten pokazuje stan ostatniego przebiegu także przy zwykłym
    // wejściu na moduł, więc meldunek stamtąd alarmowałby o wydatku sprzed wielu godzin.
    if (r?.usage) zglosKoszt({ akcja: "Odświeżanie wiadomości", usage: { costUsd: r.usage.costUsd, costKnown: r.usage.costKnown, tokens: r.usage.tokens, model: r.usage.model } });
    if (refresh?.status === "FAILED") {
      showToast(refresh.error || "Odświeżanie nie powiodło się", "error");
    } else if (r?.llmUnconfigured) {
      showToast("Model nie jest skonfigurowany — ustaw go w Admin → LLM.", "error");
    } else if (r) {
      showToast(
        r.assigned > 0 ? `Nowych wiadomości: ${r.assigned}` : "Brak nowych, istotnych wiadomości",
        r.assigned > 0 ? "success" : "info"
      );
    }
    loadStream();
    setTimeline(null);
    router.refresh();
  }, [refreshRunning, refresh, loadStream, router, showToast]);

  function startRefresh() {
    startRefreshing(async () => {
      try {
        await startNewsRefresh();
        loadRefreshState();
      } catch (e: any) {
        showToast(e.message ?? "Nie udało się uruchomić odświeżania", "error");
      }
    });
  }

  const onItemChanged = useCallback(() => {
    loadStream();
    router.refresh();
  }, [loadStream, router]);

  // ── Filtrowanie ───────────────────────────────────────────────────────────
  const pasujeZrodlo = useCallback(
    (key: string | null) => wybraneZrodla.length === 0 || key === null || wybraneZrodla.includes(key),
    [wybraneZrodla]
  );
  const pasujeTemat = useCallback(
    (id: string) => wybranyTemat === WSZYSTKIE || wybranyTemat === id,
    [wybranyTemat]
  );

  const widoczneWiadomosci = useMemo(
    () =>
      (stream ?? [])
        .filter((x) => pasujeTemat(x.id))
        .map((x) => ({ ...x, items: x.items.filter((i) => pasujeZrodlo(i.sourceKey)) })),
    [stream, pasujeTemat, pasujeZrodlo]
  );

  const widocznaOs = useMemo(
    () =>
      (timeline ?? [])
        .filter((x) => pasujeTemat(x.id))
        .map((x) => ({ ...x, entries: x.entries.filter((e) => pasujeZrodlo(e.sourceKey)) })),
    [timeline, pasujeTemat, pasujeZrodlo]
  );

  const kolejnosc = useMemo(
    () => (tresc === "items" ? widoczneWiadomosci : widocznaOs).map((x) => x.id),
    [tresc, widoczneWiadomosci, widocznaOs]
  );

  // ── Sekcje: rejestr, obserwator, przewijanie ──────────────────────────────
  const { zarejestruj, przewinDo, programoweDo } = useSekcjeTematow({
    ramaRef,
    zaslonaGory: pasekH,
    onCzytana: setCzytanyTemat,
  });

  const przewinDoPozycji = useCallback(
    (itemId: string) => {
      // 084 (AC-7): wyłączone podążanie znaczy „nie ruszaj widoku" — można wtedy czytać jedno,
      // a słuchać drugiego.
      if (!podazanie) return;
      const el = document.querySelector<HTMLElement>(`[data-news-item="${itemId}"]`);
      programoweDo.current = Date.now() + PROGRAMOWE_PRZEWIJANIE_MS;
      programoweDoRef.current = Date.now() + PROGRAMOWE_PRZEWIJANIE_MS;
      przewinDoSekcji(ramaRef.current, el, pasekH + 80);
    },
    [pasekH, programoweDo, podazanie]
  );

  /**
   * 084 (AC-7): ręczne przewinięcie GASI podążanie.
   *
   * Rozróżnienie „kto przewinął" opiera się na tym samym strażniku czasu, co obserwator sekcji:
   * przewinięcia wykonane przez lektora są w jego oknie, wszystko inne to ruch użytkownika. Bez
   * tego rozróżnienia każde przewinięcie lektora gasiłoby podążanie natychmiast po włączeniu.
   */
  const programoweDoRef = useRef(0);
  useEffect(() => {
    const rama = ramaRef.current;
    if (!rama || !podazanie) return;
    const naPrzewiniecie = () => {
      if (Date.now() < programoweDoRef.current) return;
      zmienPodazanie(false);
    };
    rama.addEventListener("scroll", naPrzewiniecie, { passive: true });
    return () => rama.removeEventListener("scroll", naPrzewiniecie);
  }, [podazanie, zmienPodazanie]);

  useEffect(() => {
    const el = pasekRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const zmierz = () => setPasekH(el.offsetHeight);
    zmierz();
    const ro = new ResizeObserver(zmierz);
    ro.observe(el);
    return () => ro.disconnect();
    // Pasek istnieje tylko w widoku wiadomości — przy zmianie zakładki mierzymy od nowa.
  }, [view, topics.length]);

  // ── Nawigator ─────────────────────────────────────────────────────────────
  const grupy = useMemo<GrupaNawigatora[]>(
    () =>
      topics.map((x) => ({
        id: x.id,
        etykieta: x.title,
        licznik: stream?.find((s) => s.id === x.id)?.items.length,
        szukajTakze: x.semanticFilter,
      })),
    [topics, stream]
  );

  /**
   * Identyfikatory w kolejności, w jakiej stoją W LIŚCIE nawigatora — czyli z pozycją zbiorczą na
   * początku. Bierzemy je z `pozycjeNawigatora`, a nie składamy tu ręcznie: reguła „«Wszystkie»
   * pierwsze" ma jedno miejsce, więc strzałki i lista nie mogą się rozjechać.
   */
  const idyNawigatora = useMemo(
    () => pozycjeNawigatora(grupy, t("wszystkieTematy")).map((g) => g.id),
    [grupy, t]
  );

  // ── Zmiana tematu: przesunięcie w bok, potem skok pionowy ─────────────────
  /**
   * 083 (AC-19/AC-20): zmiana tematu ma wyglądać jak przejście między kolumnami.
   *
   * Przesuwamy WYŁĄCZNIE własny kontener treści (`transform`), a pionowo przewijamy WYŁĄCZNIE ramę
   * widoku (`przewinDo`). To jest wprost lekcja z 082: mechanizm sięgający przodków (`scrollIntoView`)
   * przy okazji cofał stronę o kilka tysięcy pikseli, bo jego zasięgiem jest cały łańcuch
   * przewijalnych rodziców.
   */
  const [przesuw, setPrzesuw] = useState(0);
  const bezRuchu = useCallback(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const wybierzTemat = useCallback(
    (id: string) => {
      if (id === wybranyTemat) return;
      const kolejnoscPelna = topics.map((x) => x.id);
      const skad = wybranyTemat === WSZYSTKIE ? -1 : kolejnoscPelna.indexOf(wybranyTemat);
      const dokad = id === WSZYSTKIE ? -1 : kolejnoscPelna.indexOf(id);
      const kierunek = dokad > skad ? 1 : -1;
      const wracamyDoWszystkich = id === WSZYSTKIE && wybranyTemat !== WSZYSTKIE;
      const poprzedni = wybranyTemat;

      if (!bezRuchu()) {
        setPrzesuw(kierunek * PRZESUW_PX);
        requestAnimationFrame(() => setPrzesuw(0));
      }
      setViewState({ temat: id });

      // Po zmianie filtra treść jest inna, więc pozycja przewinięcia z poprzedniego tematu nic nie
      // znaczy. Wracając do „Wszystkich" wracamy do sekcji, przy której użytkownik był — inaczej
      // gubi miejsce w strumieniu.
      requestAnimationFrame(() => {
        if (wracamyDoWszystkich) przewinDo(poprzedni, false);
        else ramaRef.current?.scrollTo({ top: 0, behavior: "auto" });
      });
    },
    [wybranyTemat, topics, setViewState, przewinDo, bezRuchu]
  );

  /**
   * Strzałki: przy wybranym temacie przechodzą do sąsiedniego, przy „Wszystkich" — przewijają do
   * sąsiedniej SEKCJI. To dwie różne czynności pod tym samym gestem, bo z punktu widzenia
   * czytającego robią to samo: pokazują następny temat.
   */
  const sasiad = useCallback(
    (kierunek: -1 | 1) => {
      // Przy pozycji zbiorczej strzałka PRZEWIJA do sąsiedniej sekcji, nie zmienia filtra: wszystkie
      // tematy są już na ekranie, więc „dalej" znaczy „następny temat w treści".
      if (wybranyTemat === WSZYSTKIE) {
        const cel = sasiadujacaGrupa(kolejnosc, czytanyTemat ?? kolejnosc[0] ?? null, kierunek);
        if (cel) {
          setCzytanyTemat(cel);
          przewinDo(cel);
        }
        return;
      }
      // Przy wybranym temacie krok idzie po pozycjach NAWIGATORA, czyli razem z „Wszystkimi" na
      // początku (recenzja 083). Liczenie po samych tematach czyniło pozycję zbiorczą nieosiągalną
      // strzałką, choć w liście stoi pierwsza — a to jedyna droga powrotu do pełnego strumienia.
      const cel = sasiadujacaGrupa(idyNawigatora, wybranyTemat, kierunek);
      if (cel) wybierzTemat(cel);
    },
    [idyNawigatora, wybranyTemat, czytanyTemat, kolejnosc, przewinDo, wybierzTemat]
  );

  /** Czy strzałka ma dokąd pójść — liczone dokładnie tą samą regułą co samo przejście. */
  const sasiadIstnieje = useCallback(
    (kierunek: -1 | 1) =>
      wybranyTemat === WSZYSTKIE
        ? sasiadujacaGrupa(kolejnosc, czytanyTemat ?? kolejnosc[0] ?? null, kierunek) !== null
        : sasiadujacaGrupa(idyNawigatora, wybranyTemat, kierunek) !== null,
    [wybranyTemat, czytanyTemat, kolejnosc, idyNawigatora]
  );

  // ── Gest w bok ────────────────────────────────────────────────────────────
  const touchStart = useRef<{ x: number; y: number; interactive: boolean } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const p = e.touches[0];
    if (!p) return;
    // Gest zaczęty na przycisku/linku/polu to próba użycia tego elementu, a nie nawigacja.
    const interactive = !!(e.target as HTMLElement).closest?.(
      "button, a, input, textarea, select, [role='button'], [data-no-swipe]"
    );
    touchStart.current = { x: p.clientX, y: p.clientY, interactive };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || start.interactive) return;
    const p = e.changedTouches[0];
    if (!p) return;
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    // Świadomie NIE wołamy `preventDefault` w `touchmove`: przewijanie w pionie zostaje w 100%
    // natywne. Rozstrzygamy dopiero po zakończeniu gestu, na podstawie jego kształtu.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return;
    sasiad(dx < 0 ? 1 : -1);
  }

  // ── Akcje tematu w nagłówku sekcji (AC-21) ────────────────────────────────
  const confirmDialog = useConfirm();
  const [, startTopicAction] = useTransition();

  const usunTemat = useCallback(
    async (topic: TopicDTO) => {
      if (!(await confirmDialog(`Usunąć temat „${topic.title}" wraz z linią czasu?`))) return;
      startTopicAction(async () => {
        try {
          await deleteTopic(topic.id);
          router.refresh();
        } catch (e: any) {
          showToast(e.message ?? "Błąd", "error");
        }
      });
    },
    [confirmDialog, router, showToast]
  );

  /**
   * 083 (AC-21): edycja i usunięcie tematu stoją PRZY TEMACIE, w jego przyklejonym nagłówku.
   *
   * Do 082 siedziały w pasku nawigacji i dotyczyły „tematu aktywnego" — czyli przy widoku wszystkich
   * tematów odnosiły się do czegoś, co zmieniało się samo w trakcie przewijania. Kliknięcie kosza
   * kasowało wtedy temat, na który akurat wskazywał obserwator, a nie ten, na który patrzył
   * użytkownik.
   */
  const akcjeTematu = useCallback(
    (topicId: string) => {
      const topic = topics.find((x) => x.id === topicId);
      if (!topic) return null;
      return (
        <>
          <button
            onClick={() => setEditing(topic)}
            className="shrink-0 rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Edytuj temat"
            aria-label={`Edytuj temat: ${topic.title}`}
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => usunTemat(topic)}
            className="shrink-0 rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-red)]"
            title={t("usunTemat")}
            aria-label={`Usuń temat: ${topic.title}`}
          >
            <Trash2 size={16} />
          </button>
        </>
      );
    },
    [topics, usunTemat, t]
  );

  // ── Nawigator ─────────────────────────────────────────────────────────────
  const filtrAktywny = wybranyTemat !== WSZYSTKIE || wybraneZrodla.length > 0;

  return (
    <ModuleView
      icon={<Newspaper size={22} />}
      iconColor="var(--accent-blue)"
      title={t("wiadomosci")}
      href="/wiadomosci"
      state="ready"
      scrollRef={ramaRef}
      /**
       * 083 (AC-4/AC-5): jeden pasek zamiast trzech pięter chromu. Tytuł, zakładki modułu, akcje
       * i chrom powłoki wchodzą w JEDNĄ 48-pikselową listwę wariantu gęstego — dokładnie tak, jak
       * mają to Zadania, Zakupy i Notatki. Zgłoszenie właściciela: „za dużo miejsca zajmuje to
       * wszystko nad treścią".
       */
      density="compact"
      filters={<ViewTabs view={view} onChange={setView} />}
      headerAction={
        <>
          {/* 083 (AC-21): „nowy temat" wychodzi z paska nawigacji do akcji widoku — dodanie tematu
              nie dotyczy tematu wybranego, więc nie ma czego stać obok jego nazwy. */}
          <Button size="sm" variant="ghost" onClick={() => setCreating(true)} title="Nowy temat">
            <Plus size={15} />
            <span className="hidden md:inline">Nowy temat</span>
          </Button>
          {/* 039: „Odśwież" dotyczy CAŁEGO modułu — jeden przebieg pobiera wspólne kanały dla
              wszystkich tematów. Przycisk przy temacie sugerowałby, że da się odświeżyć jeden. */}
          <Button size="sm" onClick={startRefresh} disabled={starting || refreshRunning}>
            <RefreshCw size={15} className={starting || refreshRunning ? "animate-spin" : ""} />
            {refreshRunning ? "Odświeżam…" : "Odśwież"}
          </Button>
        </>
      }
    >
      <div className="mx-auto w-full max-w-6xl">
        <RefreshStatus state={refresh} running={refreshRunning} />

        {view === "hot" && <HotTopics onTopicsChanged={() => router.refresh()} />}

        {view === "settings" && (
          <NewsSettings sources={sources} defaultLength={defaultLength} onChanged={() => router.refresh()} />
        )}

        {view === "feed" && (
          <div
            className="min-w-0"
            // Wysokość paska jako zmienna CSS: czytają ją sekcje tematów (przyklejony nagłówek
            // i margines celu przewijania), więc nie musi ich obchodzić, skąd się bierze.
            style={{ "--news-pasek-h": `${pasekH}px` } as CSSProperties}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* 082 (poprawka): pasek nawigacji jest PRZYKLEJONY. Pasek, który odjeżdża razem
                z treścią, nie jest nawigacją, tylko nagłówkiem. `z-30` stawia go nad przyklejonymi
                nagłówkami sekcji (`z-20`), które zatrzymują się POD nim. */}
            <div
              ref={pasekRef}
              // Uchwyt dla klikacza: pasek jest jedynym elementem, którego przyklejenie i wysokość
              // są przedmiotem testu AC-20, a klasy Tailwinda nie są kontraktem.
              data-news-pasek
              className="sticky top-0 z-30 -mx-1 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-base)] px-1 pb-2 pt-1"
            >
              <GroupNavigator
                grupy={grupy}
                aktywnaId={wybranyTemat}
                onWybor={wybierzTemat}
                etykietaWszystkich={t("wszystkieTematy")}
                onSasiad={sasiad}
                moznaWstecz={sasiadIstnieje(-1)}
                moznaDalej={sasiadIstnieje(1)}
                akcje={
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <SourceFilter
                      sources={enabledSources}
                      wybrane={wybraneZrodla}
                      onZmiana={(klucze) => setViewState({ zrodla: klucze })}
                    />
                    <ContentSwitch value={tresc} onChange={(v) => setViewState({ tresc: v })} />
                  </div>
                }
              />
            </div>

            <div
              className="mt-3"
              style={{
                transform: `translateX(${przesuw}px)`,
                opacity: przesuw === 0 ? 1 : 0.4,
                transition: `transform ${PRZESUW_MS}ms var(--motion-easing, ease-out), opacity ${PRZESUW_MS}ms var(--motion-easing, ease-out)`,
              }}
            >
              {tresc === "items" ? (
                <NewsStream
                  topics={widoczneWiadomosci}
                  loading={loadingStream && stream === null}
                  filtrAktywny={filtrAktywny}
                  czytanyTemat={czytanyTemat}
                  zarejestruj={zarejestruj}
                  onChanged={onItemChanged}
                  onPrzewinDoPozycji={przewinDoPozycji}
                  podazanie={podazanie}
                  onPodazanie={zmienPodazanie}
                  akcjeTematu={akcjeTematu}
                />
              ) : (
                <NewsTimelineStream
                  topics={widocznaOs}
                  loading={loadingTimeline && timeline === null}
                  filtrAktywny={filtrAktywny}
                  czytanyTemat={czytanyTemat}
                  zarejestruj={zarejestruj}
                  akcjeTematu={akcjeTematu}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <TopicModal
          topic={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(id) => {
            setCreating(false);
            setEditing(null);
            router.refresh();
            if (id) setViewState({ temat: id });
          }}
        />
      )}
    </ModuleView>
  );
}

const VIEW_TABS: Array<{ key: View; label: string; icon: typeof Newspaper }> = [
  { key: "feed", label: "Tematy", icon: Newspaper },
  { key: "hot", label: "Gorące tematy", icon: Flame },
  { key: "settings", label: "Źródła", icon: Settings2 },
];

/**
 * 040/083: nawigacja po widokach modułu — jedna dla desktopu i telefonu (C-31).
 *
 * Od 083 zakładki mieszkają w pasku widoku (`filters` kontraktu), a nie w osobnym pasku pod
 * nagłówkiem: to był trzeci wiersz chromu nad treścią, a kontrakt widoku ma dokładnie takie miejsce
 * na filtry modułu. Zakładki zostają równorzędne i zawsze widoczne, więc powrót do wiadomości to
 * jedno dotknięcie z każdego miejsca.
 */
function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const t = useTranslations("modules.news.NewsPage");
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label={t("widokiModuluWiadomosci")}>
      {VIEW_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = view === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              // `py-3` = cel dotyku na telefonie (C-31).
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-3 text-sm transition-colors",
              active
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
          >
            <Icon size={15} />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 083: przełącznik treści — nowe wiadomości ⇄ linia czasu.
 *
 * Stoi w pasku nawigacji, a nie pod nazwą tematu, bo od 083 dotyczy CAŁEGO widoku: oś czasu działa
 * także przy wybranych wszystkich tematach (zgłoszenie właściciela).
 */
function ContentSwitch({ value, onChange }: { value: ContentKey; onChange: (v: ContentKey) => void }) {
  const t = useTranslations("modules.news.NewsPage");
  const opcje: Array<{ key: ContentKey; label: string }> = [
    { key: "items", label: t("wiadomosciKrotko") },
    { key: "timeline", label: t("liniaCzasuKrotko") },
  ];
  return (
    <div className="flex shrink-0 items-center rounded-md border border-[var(--border)] p-0.5">
      {opcje.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded px-2 py-2.5 text-xs transition-colors",
            value === o.key
              ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 039: pasek stanu przebiegu odświeżania.
 *
 * Pokazuje ETAP („Pobieram źródła (3/5)…") czytany z kolejki, a nie z pamięci komponentu — więc
 * wraca po odświeżeniu strony i po powrocie z innej zakładki. Niepowodzenie ma własny, czerwony
 * komunikat: „nic nie znaleziono" i „coś się zepsuło" to dla użytkownika dwie różne wiadomości.
 */
function RefreshStatus({ state, running }: { state: NewsRefreshState | null; running: boolean }) {
  const t = useTranslations("modules.news.NewsPage");
  if (!state) return null;

  if (running) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
        <Loader2 size={15} className="animate-spin text-[var(--accent-blue)]" />
        <span>{state.progress || "Przygotowuję odświeżanie…"}</span>
      </div>
    );
  }

  if (state.status === "FAILED") {
    return (
      <div
        className="mb-3 rounded-lg border bg-[var(--bg-surface)] px-3 py-2 text-sm"
        style={{ borderColor: "var(--accent-red)" }}
      >
        <span className="text-[var(--text-primary)]">{t("ostatnieOdswiezanieNiePowiodlo")}</span>
        {state.error && <span className="ml-2 text-xs text-[var(--text-muted)]">{state.error}</span>}
      </div>
    );
  }

  const r = state.result;
  if (state.status !== "DONE" || !r) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
      <span>
        Ostatnie odświeżanie: {formatWhen(state.startedAt)} · źródeł: {r.sources} · nowych materiałów:{" "}
        {r.fetched} · pozycji: {r.assigned} · faktów na osi: {r.timelineAdded}
      </span>
      {r.llmUnconfigured && (
        <span className="text-[var(--accent-amber)]">{t("modelNieskonfigurowanyMaterialPobrany")}</span>
      )}
      {/* `swiezy={false}`: to jest OPIS ostatniego przebiegu, a nie doniesienie o zdarzeniu —
          meldunek idzie z efektu domykającego przebieg, wyżej. */}
      <AiCostBadge usage={r.usage} akcja="Odświeżanie wiadomości" swiezy={false} align="left" />
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function TopicModal({
  topic,
  onClose,
  onSaved,
}: {
  topic: TopicDTO | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const t = useTranslations("modules.news.NewsPage");
  const { showToast } = useToast();
  const [title, setTitle] = useState(topic?.title ?? "");
  const [filter, setFilter] = useState(topic?.semanticFilter ?? "");
  const [, startTransition] = useTransition();

  function save() {
    if (!title.trim() || !filter.trim()) {
      showToast("Podaj tytuł i opis filtra", "error");
      return;
    }
    startTransition(async () => {
      try {
        if (topic) {
          await updateTopic(topic.id, { title, semanticFilter: filter });
          onSaved(topic.id);
        } else {
          const r = await createTopic({ title, semanticFilter: filter });
          onSaved(r.id);
        }
      } catch (e: any) {
        showToast(e.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <Modal
      onClose={onClose}
      title={topic ? "Edytuj temat" : "Nowy temat do monitorowania"}
      wide
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>
          <Button size="sm" onClick={save}>
            {topic ? "Zapisz" : "Dodaj temat"}
          </Button>
        </>
      }
    >
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">{t("tytulTematu")}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Sprawa Zbigniewa Ziobry"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">
          {t("filtrSemantycznyOpiszDokladnie")}
        </label>
        <textarea
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          rows={3}
          placeholder={t("npPerypetieZbigniewaZiobry")}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
    </Modal>
  );
}
