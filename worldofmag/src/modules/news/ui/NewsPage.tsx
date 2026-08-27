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
import { idList, oneOf, type RawParams } from "@/platform/viewState/viewState";
import { useRouter } from "next/navigation";
import { Newspaper, RefreshCw, Flame, Library, Plus, Loader2, Trash2, Pencil, CalendarClock, MoreVertical, BookOpen, Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { AiCostBadge } from "@/components/ui/AiCostBadge";
import { zglosKoszt } from "@/platform/ai/kosztBus";
import { ModuleView } from "@/components/ui/view";
import { KLASA_AKCJI_IKONOWEJ } from "@/components/ui/view/ViewBar";
import {
  GroupNavigator,
  sasiadujacaGrupa,
  type GrupaNawigatora,
} from "@/components/ui/nav/GroupNavigator";
import { NewsStream } from "./NewsStream";
import { NewsTimelineStream } from "./NewsTimelineStream";
import { HotTopics } from "./HotTopics";
import { NewsSettings } from "./NewsSettings";
import { NewsModuleSettings } from "./NewsModuleSettings";
import { SourceFilter } from "./SourceFilter";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
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

/**
 * 111: OŚ CZASU JEST ZAKŁADKĄ, a nie opcją przełącznika ukrytego w pasku nawigacji.
 *
 * Zgłoszenie właściciela: „może zakładki: nowe (wiadomości), gorące tematy, oś czasu — czyli
 * wydzielenie zakładki na oś czasu". Miał rację: oś czasu jest jednym z dwóch głównych sposobów
 * czytania tego modułu, a stała za przełącznikiem, którego łatwo nie zauważyć — zwłaszcza że poniżej
 * `lg` zwija się on do dwóch ikon.
 *
 * `sources` ZOSTAJE w unii, choć nie jest już zakładką: zapisane widoki (ulubione) trzymają adres,
 * więc `?widok=sources` musi nadal prowadzić do zarządzania źródłami, a nie do pustki.
 */
type View = "feed" | "hot" | "timeline" | "sources" | "settings";
/** 040/083: co pokazujemy — nowe wiadomości (domyślnie) albo linię czasu. Union TS, nie enum (C-12). */
type ContentKey = "items" | "timeline";

/** Gest w bok liczy się od tylu pikseli i musi być tyle razy bardziej poziomy niż pionowy. */
const SWIPE_MIN_PX = 40;
const SWIPE_DOMINANCE = 1.2;

export function NewsPage({
  topics,
  sources,
  defaultLength,
  showEmptyTopics: showEmptyTopicsProp,
  viewParams = {},
}: {
  topics: TopicDTO[];
  sources: SourceDTO[];
  defaultLength: SummaryLength;
  /** 085 (AC-14): czy pokazywać tematy, w których nie ma nowych wiadomości. */
  showEmptyTopics: boolean;
  /** 043: parametry adresu z serwera — stan widoku czytamy stąd, nie z `window`. */
  viewParams?: RawParams;
}) {
  const t = useTranslations("modules.news.NewsPage");
  const router = useRouter();
  const { showToast } = useToast();

  /**
   * 085 (AC-14/AC-15): stan lokalny zasilany propsem z serwera.
   *
   * Sam props nie wystarcza: przełącznik stoi w zakładce ustawień tego samego widoku, a `router
   * .refresh()` przychodzi z opóźnieniem — bez stanu lista mrugałaby starą zawartością po każdym
   * przełączeniu. Props pozostaje źródłem prawdy przy wejściu na stronę i po odświeżeniu.
   */
  const [showEmptyTopics, setShowEmptyTopics] = useState(showEmptyTopicsProp);
  useEffect(() => setShowEmptyTopics(showEmptyTopicsProp), [showEmptyTopicsProp]);

  /**
   * 043/083: cały stan widoku w ADRESIE — zakładka, wybrany temat, rodzaj treści i wybrane portale.
   *
   * To nie jest ozdoba: gwiazdka „zapisz ten widok" bierze adres, więc filtr trzymany w pamięci
   * komponentu (albo w bazie, jak było ze źródłem do 082) dawałby ulubione, które po powrocie
   * pokazuje coś innego niż w chwili zapisu.
   */
  const viewSpec = useMemo(
    () => ({
      widok: oneOf(["feed", "hot", "timeline", "sources", "settings"] as const, "feed"),
      /**
       * 111: KLUCZ ZGODNOŚCI, nie stan widoku. Do 111 to on decydował, czy widać wiadomości, czy oś
       * czasu; teraz decyduje o tym zakładka. Klucz zostaje w specyfikacji wyłącznie po to, żeby
       * zapisany wcześniej adres `?tresc=timeline` dał się odczytać i przepisać na `?widok=timeline`
       * (niżej). Bez tego ulubione zapisane przed 111 otwierałyby wiadomości zamiast osi czasu.
       */
      tresc: oneOf(["items", "timeline"] as const, "items"),
      zrodla: idList(),
      /**
       * 087 (AC-4): TRYB CZYTANIA W ADRESIE, nie w pamięci komponentu ani w bazie.
       *
       * Ta sama zasada, co przy `tresc` i `zrodla` od 084: gwiazdka „zapisz ten widok" bierze adres,
       * więc tryb trzymany gdzie indziej dawałby ulubione, które po powrocie pokazuje co innego niż
       * w chwili zapisu. Decyzja właściciela na etapie `/specify`.
       */
      czytanie: oneOf(["0", "1"] as const, "0"),
    }),
    []
  );
  const [viewState, setViewState] = useViewState(viewSpec, viewParams);
  const view = viewState.widok;
  const setView = useCallback((value: View) => setViewState({ widok: value }), [setViewState]);
  /**
   * 111: rodzaj treści WYNIKA z zakładki — jedna decyzja ma jedno miejsce.
   *
   * Dwa nośniki tej samej decyzji (zakładka i przełącznik) dałyby stany bez sensu, np. „zakładka
   * Oś czasu, przełącznik Wiadomości". Ta sama lekcja co w 083/084 przy filtrze tematów.
   */
  const tresc: ContentKey = view === "timeline" ? "timeline" : "items";
  /** Zakładki pokazujące strumień tematów — obie karmi ten sam pasek nawigacji. */
  const widokTresci = view === "feed" || view === "timeline";

  /**
   * 111: ZAPISANE WIDOKI SPRZED 111 MUSZĄ DALEJ DZIAŁAĆ.
   *
   * Gwiazdka „zapisz ten widok" zapamiętuje ADRES, a do 111 oś czasu mieszkała w kluczu `tresc`.
   * Ulubione zapisane wcześniej niosą więc `?tresc=timeline` — bez tego przepisania otworzyłyby
   * wiadomości, czyli co innego niż w chwili zapisu. To jest ta sama pułapka, którą 084 zafundowało
   * kluczowi `temat`; tym razem jest obsłużona, a nie odkryta po fakcie.
   *
   * Przepisujemy RAZ, przy wejściu: `tresc` znika z adresu, a zakładka staje się jedynym nośnikiem.
   */
  useEffect(() => {
    if (viewState.tresc === "timeline" && view === "feed") {
      setViewState({ widok: "timeline", tresc: "items" });
    }
  }, [viewState.tresc, view, setViewState]);
  const wybraneZrodla = viewState.zrodla;
  const trybCzytania = viewState.czytanie === "1";

  /**
   * 084: NIE MA JUŻ „TEMATU WYBRANEGO" — jest tylko temat CZYTANY.
   *
   * 083 zrobiło z listy tematów FILTR (wybór zawężał widok do jednej sekcji). Właściciel po testach
   * zdecydował inaczej: „drop-down powinien dawać tylko możliwość łatwego przeskoku do wybranego
   * tematu, a nie ograniczenie widoku do jednego tematu. Więc na widoku powinny być wiadomości
   * z wszystkich tematów."
   *
   * Została więc jedna wartość: który temat użytkownik akurat CZYTA. Wynika z przewijania
   * (obserwator sekcji) i służy do podświetlenia nagłówka. Filtr zniknął razem z kluczem `temat`
   * w adresie — jedna kontrolka ma mieć jedno znaczenie, a dwa nośniki tej samej decyzji już raz
   * dały stany bez sensu (lekcja z 083).
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
  /**
   * Jawne przełączenie przez użytkownika — i TYLKO ono trafia do ustawień konta.
   *
   * Recenzja 084: automatyczne wyłączenie (po ręcznym przewinięciu) zapisywało się tak samo, więc
   * jedno muśnięcie ekranu trwale gasiło funkcję, o której użytkownik nawet nie wiedział, że ją ma.
   * Wyłączenie „na teraz" nie jest decyzją o ustawieniach.
   */
  const zmienPodazanie = useCallback((wlaczone: boolean) => {
    setPodazanie(wlaczone);
    void updateAssistantPrefs({ readerFollow: wlaczone }).catch(() => {});
  }, []);

  /** Czy lektor faktycznie czyta — decyduje, czy w ogóle pilnujemy ręcznego przewijania. */
  const [lektorGra, setLektorGra] = useState(false);

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
    if (widokTresci && tresc === "items") loadStream();
  }, [widokTresci, tresc, loadStream]);

  useEffect(() => {
    // Oś czasu czytamy dopiero, gdy jest na ekranie — to osobne, niemałe zapytanie.
    if (widokTresci && tresc === "timeline") loadTimeline();
  }, [widokTresci, tresc, loadTimeline]);

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
  /**
   * 084 (AC-13): filtrujemy po portalach — filtr TEMATU nie istnieje.
   * 085 (AC-14): temat, w którym po tym filtrowaniu nic nie zostaje, domyślnie znika z listy.
   *
   * Odsiew jest tutaj, a nie w zapytaniu serwerowym, bo TEN SAM zbiór zasila treść i listę skoku
   * (`GroupNavigator`). Gdyby serwer odsiewał, a widok nie, lista skoku prowadziłaby do sekcji,
   * których nie ma — i odwrotnie.
   */
  const widoczneWiadomosci = useMemo(() => {
    const zPortalami = (stream ?? []).map((x) => ({
      ...x,
      items: x.items.filter((i) => pasujeZrodlo(i.sourceKey)),
    }));
    return showEmptyTopics ? zPortalami : zPortalami.filter((x) => x.items.length > 0);
  }, [stream, pasujeZrodlo, showEmptyTopics]);

  const widocznaOs = useMemo(() => {
    const zPortalami = (timeline ?? []).map((x) => ({
      ...x,
      entries: x.entries.filter((e) => pasujeZrodlo(e.sourceKey)),
    }));
    return showEmptyTopics ? zPortalami : zPortalami.filter((x) => x.entries.length > 0);
  }, [timeline, pasujeZrodlo, showEmptyTopics]);

  /**
   * 085 (AC-16): lista jest pusta, BO ODSIALIŚMY — tematy istnieją, tylko nic dziś nie przyniosły.
   * Rozróżnienie należy do widoku, bo tylko on wie, ile tematów przyszło z serwera.
   */
  const wszystkieUkryte =
    !showEmptyTopics &&
    topics.length > 0 &&
    (tresc === "items" ? widoczneWiadomosci : widocznaOs).length === 0;

  const kolejnosc = useMemo(
    () => (tresc === "items" ? widoczneWiadomosci : widocznaOs).map((x) => x.id),
    [tresc, widoczneWiadomosci, widocznaOs]
  );

  /**
   * 087: ta sama zasłona, ale jako LICZBA — potrzebna przewijaniu i obserwatorowi sekcji.
   *
   * Czytamy ją ŚWIEŻO w momencie użycia (`--view-bar-h` jest zwykłą wartością w pikselach ustawianą
   * przez ramę, więc `getComputedStyle` ją rozwiązuje), zamiast trzymać w stanie. Trzymana w stanie
   * musiałaby mieć własnego obserwatora paska widoku — czyli dokładnie to, co w 086 się rozjechało.
   */
  const zaslonaTeraz = useCallback(() => {
    const rama = ramaRef.current;
    const pasekWidoku = rama ? parseFloat(getComputedStyle(rama).getPropertyValue("--view-bar-h")) || 0 : 0;
    return pasekWidoku + pasekH;
  }, [pasekH]);

  // ── Sekcje: rejestr, obserwator, przewijanie ──────────────────────────────
  const { zarejestruj, przewinDo, programoweDo } = useSekcjeTematow({
    ramaRef,
    zaslonaGory: zaslonaTeraz,
    onCzytana: setCzytanyTemat,
  });

  const przewinDoPozycji = useCallback(
    (itemId: string) => {
      // 084 (AC-7): wyłączone podążanie znaczy „nie ruszaj widoku" — można wtedy czytać jedno,
      // a słuchać drugiego.
      if (!podazanie) return;
      const el = document.querySelector<HTMLElement>(`[data-news-item="${itemId}"]`);
      programoweDo.current = Date.now() + PROGRAMOWE_PRZEWIJANIE_MS;
      przewinDoSekcji(ramaRef.current, el, zaslonaTeraz() + 80);
    },
    [zaslonaTeraz, programoweDo, podazanie]
  );

  /**
   * 084 (AC-7): ręczne przewinięcie GASI podążanie — ale tylko wtedy, gdy jest co gasić.
   *
   * Dwie poprawki po recenzji. **Po pierwsze**, nasłuch działa wyłącznie, gdy lektor CZYTA: wcześniej
   * wisiał zawsze, więc zwykłe przewinięcie listy przez kogoś, kto nigdy nie włączył odsłuchu,
   * trwale wyłączało mu ustawienie. **Po drugie**, gaśnie tylko stan bieżący (`setPodazanie`), a nie
   * preferencja konta — automatyczne wyłączenie nie jest decyzją użytkownika o ustawieniach.
   *
   * Rozróżnienie „kto przewinął" opiera się na strażniku czasu Z HOOKA sekcji — tym samym, którego
   * używa przewijanie do sekcji i do pozycji. Drugi, własny ref (pierwsza wersja) nie był aktualizowany
   * przez `przewinDo`, więc skok do tematu — czyli sedno AC-11 — gasił podążanie użytkownikowi,
   * który zrobił dokładnie to, o co go poproszono.
   */
  useEffect(() => {
    const rama = ramaRef.current;
    if (!rama || !podazanie || !lektorGra) return;
    const naPrzewiniecie = () => {
      if (Date.now() < programoweDo.current) return;
      setPodazanie(false);
    };
    rama.addEventListener("scroll", naPrzewiniecie, { passive: true });
    return () => rama.removeEventListener("scroll", naPrzewiniecie);
  }, [podazanie, lektorGra, programoweDo]);


  /**
   * 087 (AC-15): ZASŁONA JEST WYRAŻENIEM CSS, NIE PRZELICZANĄ LICZBĄ — poprawka błędu z 086.
   *
   * 086 liczyło `--news-pasek-h` jako `--view-bar-h + wysokość paska modułu` w efekcie, którego
   * `ResizeObserver` pilnuje paska modułu i ramy. Zmiana wysokości PASKA WIDOKU nie zmienia rozmiaru
   * żadnego z nich, więc obserwator się nie budzi i liczba zostaje stara. Zmierzone przy 360 px po
   * podniesieniu paska widoku o 40 px (u właściciela robi to przycisk „Odświeżam…", który zawija
   * drugi wiersz): `--view-bar-h` 101 → 141, `--news-pasek-h` **bez zmian, 160 px**, a przyklejone
   * nagłówki rozjeżdżają się o 40 px. W jedną stronę wjeżdżają pod pasek, w drugą przyklejają się
   * za nisko — i wtedy w szczelinie widać przewijaną treść. Dokładnie to zgłosił właściciel.
   *
   * Publikujemy więc WYŁĄCZNIE własną wysokość, a sumowanie zostawiamy przeglądarce: zasłona to
   * `calc(var(--view-bar-h, 0px) + <ta wysokość>)`. `calc()` przelicza się przy każdej zmianie
   * `--view-bar-h` sam z siebie, więc nie ma czego synchronizować i nie ma czym się rozjechać —
   * znika cała klasa błędu „obserwator nie widzi zmiany, która stoi wyżej".
   */
  useEffect(() => {
    const el = pasekRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const zmierz = () => setPasekH(Math.max(0, Math.round(el.offsetHeight)));
    zmierz();
    const ro = new ResizeObserver(zmierz);
    ro.observe(el);
    return () => ro.disconnect();
    // Pasek istnieje tylko w widoku wiadomości — przy zmianie zakładki mierzymy od nowa.
  }, [view, topics.length]);

  // ── Nawigator ─────────────────────────────────────────────────────────────
  /**
   * 085 (AC-14): lista skoku pokazuje DOKŁADNIE te tematy, które są w treści.
   *
   * Dopóki dane się wczytują, pokazujemy wszystkie: nie wiemy jeszcze, który temat jest pusty,
   * a pusta lista skoku na starcie wyglądałaby jak brak tematów.
   */
  const grupy = useMemo<GrupaNawigatora[]>(() => {
    const zaladowane = tresc === "items" ? stream !== null : timeline !== null;
    const widoczne = new Set((tresc === "items" ? widoczneWiadomosci : widocznaOs).map((x) => x.id));
    return topics
      .filter((x) => !zaladowane || widoczne.has(x.id))
      .map((x) => ({
        id: x.id,
        etykieta: x.title,
        licznik: stream?.find((s) => s.id === x.id)?.items.length,
        szukajTakze: x.semanticFilter,
      }));
  }, [topics, stream, timeline, tresc, widoczneWiadomosci, widocznaOs]);

  // ── Skok do tematu ────────────────────────────────────────────────────────
  /**
   * 084 (AC-11): wybór z listy PRZEWIJA do sekcji tematu i nic poza tym.
   *
   * Nie ma już przesunięcia w bok ani przejścia „między kolumnami" (083/AC-19): kolumn nie ma, bo
   * nie ma filtru — wszystkie tematy są na ekranie przez cały czas, a lista służy do skoku między
   * nimi. Animacja przejścia opisywałaby zmianę, która się nie odbywa.
   *
   * Przewijamy WYŁĄCZNIE ramę widoku (`przewinDo` → `przewinDoSekcji`), nigdy mechanizmem
   * sięgającym przodków — to zostaje z 082 i jest nadal jedyną rzeczą, która stoi między nami
   * a skokiem strony o kilka tysięcy pikseli.
   */
  const skoczDoTematu = useCallback(
    (id: string) => {
      setCzytanyTemat(id);
      przewinDo(id);
    },
    [przewinDo]
  );

  /**
   * Strzałki „poprzednia / następna grupa" ZNIKAJĄ z paska (AC-12) — właściciel poprosił wprost.
   * Skok do sąsiada zostaje jednak dostępny GESTEM w bok na telefonie, bo tam jest skrótem, a nie
   * jedyną drogą: lista tematów daje to samo jednym dotknięciem.
   */
  const sasiad = useCallback(
    (kierunek: -1 | 1) => {
      const cel = sasiadujacaGrupa(kolejnosc, czytanyTemat ?? kolejnosc[0] ?? null, kierunek);
      if (cel) skoczDoTematu(cel);
    },
    [kolejnosc, czytanyTemat, skoczDoTematu]
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
      if (!(await confirmDialog({ title: `Usunąć temat „${topic.title}" wraz z linią czasu?`, destructive: true }))) return;
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
      return <MenuTematu topic={topic} onEdytuj={() => setEditing(topic)} onUsun={() => usunTemat(topic)} />;
    },
    [topics, usunTemat]
  );

  // ── Nawigator ─────────────────────────────────────────────────────────────
  // 084: jedynym filtrem został wybór portali — tematy są zawsze wszystkie.
  const filtrAktywny = wybraneZrodla.length > 0;

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
      /**
       * 087 (AC-1): TRYB CZYTANIA chowa chrom modułu — pasek stanu, zakładki, akcje główne
       * i ustawienia. Zostaje własny pasek nawigacji (skok do tematu, filtr portali, przełącznik
       * treści) oraz lektor, czyli dokładnie to, o co prosił właściciel: „jak najwięcej miejsca dla
       * samych wiadomości, ale nadal z lektorem i nawigacją".
       */
      // Tylko w widoku wiadomości: pasek modułu (a w nim JEDYNE wyjście z trybu) renderuje się
      // wyłącznie tam, więc `chromeless` na innej zakładce zostawiłby ramę bez klamki.
      chromeless={trybCzytania && widokTresci}
      filters={trybCzytania ? undefined : <ViewTabs view={view} onChange={setView} />}
      /**
       * 087 (AC-7): ustawienia modułu w slocie ramy, nie jako czwarta zakładka. Ten sam przycisk
       * wchodzi i wychodzi (`active`), bo bez zakładki nie byłoby dokąd wracać.
       */
      settings={
        trybCzytania
          ? undefined
          : {
              onClick: () => setView(view === "settings" ? "feed" : "settings"),
              active: view === "settings",
              label: t("ustawieniaModulu"),
            }
      }
      headerAction={
        trybCzytania ? undefined : (
        <>
          {/* 083 (AC-21): „nowy temat" wychodzi z paska nawigacji do akcji widoku — dodanie tematu
              nie dotyczy tematu wybranego, więc nie ma czego stać obok jego nazwy. */}
          {/**
            * 111: „Nowy temat" jest na telefonie SAMĄ IKONĄ, więc nie rozciąga się (C-33, klasa
            * z ramy). Do 111 pasek rozciągał wszystkie trzy akcje po równo i wiersz wyglądał na
            * pusty — zgłoszenie właściciela: „dwie ikony po bokach i jedna ikona z tekstem na
            * środku". Rozciąga się tylko „Odśwież", bo tylko on ma czym wypełnić szerokość.
            */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCreating(true)}
            title="Nowy temat"
            aria-label="Nowy temat"
            className={KLASA_AKCJI_IKONOWEJ}
          >
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
        )
      }
    >
      <div className="mx-auto w-full max-w-6xl">
        {!trybCzytania && <RefreshStatus state={refresh} running={refreshRunning} />}

        {view === "hot" && <HotTopics monitorowane={topics} onTopicsChanged={() => router.refresh()} />}

        {view === "sources" && (
          <NewsSettings sources={sources} onChanged={() => router.refresh()} />
        )}

        {view === "settings" && (
          <NewsModuleSettings
            defaultLength={defaultLength}
            showEmptyTopics={showEmptyTopics}
            onShowEmptyTopics={setShowEmptyTopics}
            onChanged={() => router.refresh()}
          />
        )}

        {widokTresci && (
          <div
            className="min-w-0"
            // Wysokość paska jako zmienna CSS: czytają ją sekcje tematów (przyklejony nagłówek
            // i margines celu przewijania), więc nie musi ich obchodzić, skąd się bierze.
            style={{ "--news-pasek-h": `calc(var(--view-bar-h, 0px) + ${pasekH}px)` } as CSSProperties}
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
              /* 084 (AC-17): `min-w-0` na pasku i na jego elastycznych dzieciach. Element `flex`
                 ma domyślnie `min-width: auto`, więc NIE POTRAFI zwęzić się poniżej swojej treści —
                 i to on, a nie jego zawartość, rozpychał stronę: zmierzone 377 px przy ekranie
                 360 px, czyli poziome przewijanie CAŁEJ strony (C-31, błąd twardy). */
              /* 085 (AC-4): pasek widoku jest teraz PRZYKLEJONY u góry ramy, więc pasek nawigacji
                 modułu przykleja się POD nim — inaczej wjechałby na niego. Wysokość tamtego podaje
                 rama zmienną `--view-bar-h`; przy jej braku (widok osadzony poza ramą) zostaje 0,
                 czyli zachowanie sprzed zmiany. */
              style={{ top: "var(--view-bar-h, 0px)" }}
              className="sticky z-30 flex min-w-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-base)] pb-2 pt-1"
            >
              {/* 084 (AC-11, AC-12, AC-18): lista tematów jest SKOKIEM, nie filtrem.
                  `aktywnaId` wskazuje temat CZYTANY, więc lista pokazuje, gdzie jesteś, a wybór
                  przewija tam, gdzie chcesz być. Strzałek nie podajemy — `onSasiad` zostaje
                  w komponencie dla innych konsumentów (C-53), a tutaj gest w bok na telefonie robi
                  to samo i jest skrótem, nie jedyną drogą. */}
              <GroupNavigator
                grupy={grupy}
                aktywnaId={czytanyTemat ?? kolejnosc[0] ?? ""}
                onWybor={skoczDoTematu}
                /* 084 (AC-18): wyzwalacz nosi STAŁĄ etykietę, nie nazwę tematu. Nazwa tematu, przy
                   którym jesteś, stoi w przyklejonym nagłówku jego sekcji — pokazywanie jej także
                   tutaj było zgłoszeniem właściciela po 083 („podwójnie mamy bieżący temat").
                   Przy okazji: stała etykieta ma stałą szerokość, więc pasek przestaje skakać. */
                /* 086 (AC-21): etykieta mówi, CO robi kontrolka, a nie powtarza nazwy zakładki.
                   Zgłoszenie właściciela: „zakładka nazywa się tematy i ten input nazywa się tematy,
                   co wprawia usera w dezorientację. Skoro to już jest tylko element do nawigacji do
                   konkretnego tematu, a nie filtr". */
                etykietaStala={t("przejdzDoTematu")}
                akcje={
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <SourceFilter
                      sources={enabledSources}
                      wybrane={wybraneZrodla}
                      onZmiana={(klucze) => setViewState({ zrodla: klucze })}
                      /* 111 (AC-17): „Źródła" przestały być zakładką, więc zarządzanie nimi
                         wchodzi tam, gdzie i tak stoi ich filtr. Adres `?widok=sources` nadal
                         działa — ulubione zapisane wcześniej muszą prowadzić tam, gdzie prowadziły. */
                      onZarzadzaj={() => setView("sources")}
                    />
                    {/**
                      * 087 (AC-3): przełącznik trybu czytania stoi W PASKU MODUŁU, a nie w akcjach
                      * widoku — bo w trybie czytania akcji widoku nie ma, więc byłby jedynym
                      * wyjściem, którego nie widać. Wejście i wyjście to ten sam przycisk.
                      */}
                    <button
                      type="button"
                      onClick={() => setViewState({ czytanie: trybCzytania ? "0" : "1" })}
                      aria-pressed={trybCzytania}
                      title={trybCzytania ? t("wyjdzZTrybuCzytania") : t("trybCzytania")}
                      aria-label={trybCzytania ? t("wyjdzZTrybuCzytania") : t("trybCzytania")}
                      className={cn(
                        "shrink-0 rounded-md border px-2.5 py-3 transition-colors",
                        trybCzytania
                          ? "border-[var(--accent-blue)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                      )}
                    >
                      {trybCzytania ? <Minimize2 size={14} /> : <BookOpen size={14} />}
                    </button>
                  </div>
                }
              />
            </div>

            <div className="mt-3">
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
                  onGra={setLektorGra}
                  wszystkieUkryte={wszystkieUkryte}
                  akcjeTematu={akcjeTematu}
                />
              ) : (
                <NewsTimelineStream
                  topics={widocznaOs}
                  loading={loadingTimeline && timeline === null}
                  filtrAktywny={filtrAktywny}
                  czytanyTemat={czytanyTemat}
                  zarejestruj={zarejestruj}
                  wszystkieUkryte={wszystkieUkryte}
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
            // 084: po dodaniu tematu SKACZEMY do niego zamiast go „wybierać" — filtru już nie ma,
            // a użytkownik i tak chce zobaczyć, co właśnie stworzył.
            if (id) skoczDoTematu(id);
          }}
        />
      )}
    </ModuleView>
  );
}

/**
 * 087 (AC-7): TRZY zakładki. Ustawienia wyszły stąd do slotu w pasku akcji, który rama rysuje
 * jednakowo dla wszystkich modułów — zakładki są miejscem na WIDOKI, nie na konfigurację.
 *
 * 085 (AC-17): cztery zakładki, ale nie cztery etykiety.
 *
 * „Ustawienia" to zakładka, po którą sięga się raz na kilka tygodni, a czwarta pełna etykieta
 * wypchnęłaby pasek poza ekran telefonu (mierzone w 084: przy 360 px na wszystko jest 360 px, a
 * „Gorące tematy" samo bierze ~110). Dlatego ustawienia stoją jako sama ikona koła zębatego
 * z etykietą dla czytnika ekranu — funkcja zostaje, miejsce nie.
 */
const VIEW_TABS: Array<{ key: View; label: string; icon: typeof Newspaper; tylkoIkona?: boolean }> = [
  // 111: „Wiadomości", nie „Tematy" — zakładka nazywa RODZAJ TREŚCI, tak jak dwie pozostałe.
  // Nazwa „Tematy" mówiła o osi podziału (tematy), a nie o tym, co się w niej czyta.
  { key: "feed", label: "Wiadomości", icon: Newspaper },
  { key: "hot", label: "Gorące tematy", icon: Flame },
  // 111: oś czasu awansuje z opcji przełącznika na zakładkę — zgłoszenie właściciela.
  { key: "timeline", label: "Oś czasu", icon: CalendarClock },
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
            title={tab.label}
            aria-label={tab.label}
            className={cn(
              // `py-3` = cel dotyku na telefonie (C-31).
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-3 text-sm transition-colors",
              active
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
          >
            <Icon size={15} />
            {!tab.tylkoIkona && <span className="whitespace-nowrap">{tab.label}</span>}
          </button>
        );
      })}
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

  /**
   * 111: UDANY PRZEBIEG TO JEDNA LICZBA — KIEDY.
   *
   * Zgłoszenie właściciela: „tu wystarczy tylko czas ostatniego odświeżenia". Poprzednia wersja
   * pisała pięć liczb w jednym zdaniu („źródeł: 9 · nowych materiałów: 1 · pozycji: 2 · faktów na
   * osi: 1"), z czego na co dzień liczy się wyłącznie pierwsza — a przy wąskim ekranie zdanie
   * zawijało się na dwa wiersze i zjadało miejsce nad treścią.
   *
   * Liczby nie znikają, tylko przestają zajmować wiersz: idą do podpowiedzi i do etykiety dla
   * czytnika ekranu. Skróceniu podlega WYŁĄCZNIE opis udanego przebiegu — „trwa" i „nie powiodło
   * się" zostają w pełnej postaci, bo tam każde słowo jest potrzebne od razu.
   */
  const szczegoly =
    `źródeł: ${r.sources} · nowych materiałów: ${r.fetched} · pozycji: ${r.assigned} · ` +
    `faktów na osi: ${r.timelineAdded}`;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
      <span title={szczegoly} aria-label={`Ostatnie odświeżanie: ${formatWhen(state.startedAt)} — ${szczegoly}`}>
        Ostatnie odświeżanie: {formatWhen(state.startedAt)}
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

/**
 * 087 (AC-11, AC-12): RZADKIE AKCJE TEMATU POD TRZEMA KROPKAMI.
 *
 * Edycja i usunięcie tematu stały odsłonięte w nagłówku KAŻDEJ sekcji — dwie ikony razy kilkanaście
 * tematów, w pasku, który i tak jest ciasny na telefonie. Zgłoszenie właściciela: „te ikony niech
 * będą dostępne w dropdown poprzez ikonę z trzema kropkami".
 *
 * Stoi na `AnchoredLayer` — tym samym prymitywie, co filtr portali w tym module (C-53): zamykanie
 * klikiem obok, pozycjonowanie i portal do `body` dostajemy gotowe. Usunięcie zostaje jawnie
 * destrukcyjne (C-34) — okno potwierdzenia rysuje `usunTemat`.
 */
function MenuTematu({
  topic,
  onEdytuj,
  onUsun,
}: {
  topic: TopicDTO;
  onEdytuj: () => void;
  onUsun: () => void;
}) {
  const t = useTranslations("modules.news.NewsPage");
  const [otwarte, setOtwarte] = useState(false);
  const kotwicaRef = useRef<HTMLDivElement>(null);

  const pozycja =
    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]";

  return (
    <div ref={kotwicaRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOtwarte((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={otwarte}
        title={t("wiecejDzialan")}
        aria-label={t("wiecejDzialanTematu", { temat: topic.title })}
        className="shrink-0 rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <MoreVertical size={16} />
      </button>

      <AnchoredLayer
        anchorRef={kotwicaRef}
        open={otwarte}
        onClose={() => setOtwarte(false)}
        side="dol"
        align="koniec"
        width={220}
        role="menu"
        ariaLabel={t("wiecejDzialan")}
      >
        <button type="button" role="menuitem" className={pozycja} onClick={() => { setOtwarte(false); onEdytuj(); }}>
          <Pencil size={15} className="shrink-0 text-[var(--text-muted)]" />
          {t("edytujTemat")}
        </button>
        <button
          type="button"
          role="menuitem"
          className={`${pozycja} hover:text-[var(--accent-red)]`}
          onClick={() => { setOtwarte(false); onUsun(); }}
        >
          <Trash2 size={15} className="shrink-0 text-[var(--text-muted)]" />
          {t("usunTemat")}
        </button>
      </AnchoredLayer>
    </div>
  );
}
