"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Square, Volume2, ChevronLeft, ChevronRight, Gauge, Crosshair, Ban, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { splitSentences } from "@/lib/speech/sentences";
import {
  primeSpeech,
  speak,
  stopSpeaking,
  speechAvailable,
  setSpeechRate,
  setServerVoiceId,
  setSpeechFallbackNotice,
} from "@/lib/tts";
import { getAssistantPrefs, updateAssistantPrefs, getSpeechOptions } from "@/actions/assistantPrefs";
import { podpisBlokow } from "../lib/podpisBlokow";

/**
 * 039: lektor wiadomości — czyta zdanie po zdaniu i podświetla to, które właśnie leci.
 *
 * Dlaczego łańcuch po `onEnd`, a nie znaczniki czasu od dostawcy: `speak()` woła `onEnd` zarówno
 * dla głosu serwerowego, jak i dla syntezy przeglądarki, więc ta sama pętla działa w obu ścieżkach
 * i nie wymaga niczego od dostawcy TTS (decyzja właściciela). Ceną jest ziarnistość zdania —
 * i dokładnie o zdanie chodzi w podświetleniu.
 *
 * 044: lektor przyjmuje LISTĘ BLOKÓW zamiast jednego tekstu. Właściciel poprosił o odsłuch na
 * trzech poziomach — jednej wiadomości, całego tematu i całego strumienia — a to są dokładnie te
 * same zdania, tylko w innej liczbie. Drugi komponent lektora byłby duplikatem całej mechaniki
 * (łańcuch, pauza, podświetlenie, sprzątanie mowy przy odmontowaniu), więc uogólniamy istniejący.
 * Przy jednym bloku UI wygląda i działa dokładnie tak jak przed zmianą.
 */

/** Jedna wiadomość do przeczytania. `lead` jest zapowiedzią kontekstu („Temat: …"). */
export interface ReaderBlock {
  /** Czytane jako osobne zdanie PRZED tytułem — używane do zapowiedzi zmiany tematu. */
  lead?: string;
  title: string;
  text: string;
}

/** Zdanie wraz z informacją, z którego bloku pochodzi — po tym budujemy nawigację „o wiadomość". */
interface Sentence {
  text: string;
  block: number;
}

/**
 * 044: W CAŁEJ APLIKACJI GRA NAJWYŻEJ JEDEN LEKTOR.
 *
 * `speak()` z `lib/tts` przerywa poprzednią wypowiedź (obie ścieżki wołają `cancel()`), więc dwa
 * jednocześnie grające lektory nie dają dwóch głosów naraz — one się WZAJEMNIE UCINAJĄ: przerwana
 * wypowiedź odpala `onend`, łańcuch drugiego lektora przechodzi do kolejnego zdania i przerywa
 * pierwszy, i tak w kółko. Słychać wtedy kilkanaście urwanych sylab na przemian.
 *
 * Dało się to złapać już przed 044 (odsłuch otwarty na dwóch kartach naraz), ale 044 stawia obok
 * siebie lektora strumienia, lektora tematu i lektora pojedynczej karty, więc trafienie w to
 * przestaje być przypadkiem. Rejestr jest modułowy, bo problem jest globalny — instancje lektora
 * nie mają wspólnego rodzica (karta siedzi w innym poddrzewie niż pasek strumienia).
 */
let activeStopper: (() => void) | null = null;

/** 084 (AC-8): ile ciszy zostawiamy między wiadomościami, żeby dało się usłyszeć granicę. */
const PRZERWA_MIEDZY_WIADOMOSCIAMI_MS = 400;

function claimSpeech(stop: () => void) {
  if (activeStopper && activeStopper !== stop) activeStopper();
  activeStopper = stop;
}

function releaseSpeech(stop: () => void) {
  if (activeStopper === stop) activeStopper = null;
}

export function NewsReader({
  blocks,
  onBlockChange,
  onCzytaneZdanie,
  onZamknij,
  podazanie = true,
  onPodazanie,
  onGra,
  autoStart = false,
}: {
  blocks: ReaderBlock[];
  /** Wywoływane, gdy lektor przechodzi do innej wiadomości — pozwala przewinąć widok do niej. */
  onBlockChange?: (blockIndex: number) => void;
  /**
   * 084 (AC-5): treść zdania, które właśnie leci — do podświetlenia W KARCIE wiadomości.
   *
   * Podajemy TEKST, nie indeks: lektor i karta dzielą ten sam podział na zdania
   * (`lib/speech/sentences`), więc porównanie treści jest jednoznaczne, a indeks wymagałby
   * utrzymywania zgodności dwóch list i psuł się przy pierwszej rozbieżności.
   */
  onCzytaneZdanie?: (zdanie: string | null, blockIndex: number | null) => void;
  /** Zamknięcie lektora — pasek jest jedynym miejscem, z którego da się go wyłączyć. */
  onZamknij?: () => void;
  /** 084 (AC-6): podążanie za czytanym tekstem — stan WIDOKU, nie lektora. */
  podazanie?: boolean;
  onPodazanie?: (wlaczone: boolean) => void;
  /**
   * 084 (recenzja): czy lektor FAKTYCZNIE czyta (gra i nie jest wstrzymany).
   *
   * Rama widoku gasi podążanie po ręcznym przewinięciu — i musi wiedzieć, czy jest co gasić.
   * Bez tego zwykłe przewinięcie listy przez kogoś, kto nigdy nie włączył odsłuchu, wyłączało mu
   * ustawienie, o którym nie wiedział.
   */
  onGra?: (gra: boolean) => void;
  /**
   * 084 (AC-10): odsłuch rusza OD RAZU po otwarciu lektora.
   *
   * Do 083 „Słuchaj" tylko pokazywało pasek, a czytanie zaczynało się dopiero po drugim dotknięciu
   * („Czytaj"). Dwa kliknięcia na jedną intencję — a właściciel poprosił wprost o lepszy UX
   * otwierania lektora. Odblokowanie dźwięku (`primeSpeech`) należy wtedy do konsumenta i musi
   * nastąpić SYNCHRONICZNIE w geście otwarcia, inaczej iOS odmówi.
   */
  autoStart?: boolean;
}) {
  const t = useTranslations("modules.news.NewsReader");
  // Zdania wszystkich bloków w jednej, płaskiej liście: łańcuch `onEnd` nie musi wtedy wiedzieć nic
  // o granicach wiadomości, a numer bloku i tak mamy przy każdym zdaniu.
  const sentences = useMemo<Sentence[]>(() => {
    const out: Sentence[] = [];
    blocks.forEach((b, block) => {
      if (b.lead?.trim()) out.push({ text: b.lead.trim(), block });
      // Tytuł czytamy jako pierwsze zdanie — bez niego odsłuch zaczyna się w połowie myśli.
      if (b.title.trim()) out.push({ text: b.title.trim(), block });
      for (const s of splitSentences(b.text)) out.push({ text: s, block });
    });
    return out;
  }, [blocks]);

  const multi = blocks.length > 1;

  const [current, setCurrent] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [supported, setSupported] = useState(true);
  /**
   * 084 (AC-2): „mowa nie ruszyła". Osobny stan od `paused` i od `current == null`, bo znaczy coś
   * trzeciego: użytkownik poprosił o odczyt, a urządzenie nie wydało dźwięku. Dopóki tego stanu nie
   * było, lektor pokazywał postęp przy zerowym dźwięku — i to jest zgłoszenie właściciela.
   */
  const [cisza, setCisza] = useState<string | null>(null);
  // Indeks trzymany też w ref, bo `onEnd` domyka wartość z chwili wywołania `speak`.
  const indexRef = useRef(0);
  const activeRef = useRef(false);
  // Ostatnio zgłoszona na zewnątrz wiadomość — zapobiega powtarzaniu `onBlockChange` co zdanie.
  const lastReportedBlock = useRef<number | null>(null);

  /**
   * 080 (Z12): prędkość czytania i „podążaj za czytaniem" — z ustawień użytkownika, nie z powietrza.
   *
   * Wartości startowe odpowiadają dotychczasowemu zachowaniu (0.95 i podążanie włączone), więc kto
   * niczego nie zmieni, nie zauważy różnicy. Ładujemy je raz; zapis idzie w tle, bo czekanie na
   * odpowiedź serwera przy przesuwaniu suwaka byłoby widoczne jako zacinanie.
   */
  const [rate, setRate] = useState(0.95);
  /**
   * 084 (AC-6): PODĄŻANIE nie jest już stanem lektora — jest stanem WIDOKU i przychodzi propsem.
   *
   * Powód: ma teraz dwa wejścia (ten pasek i nagłówek sekcji tematu) oraz jedno wyjście poza
   * lektorem (samoczynne wyłączenie, gdy użytkownik przewinie sam). Dwa stany dałyby przełącznik,
   * który pokazuje co innego, niż robi widok.
   */
  const followRef = useRef(podazanie);
  followRef.current = podazanie;

  /**
   * 084: LEKTOR KONFIGURUJE WŁASNY GŁOS — i rozstrzyga jego dostępność, ZANIM ktokolwiek dotknie
   * „słuchaj".
   *
   * Dwie usterki naraz, obie zgłoszone jako „niby leci a nie słyszę":
   *
   * 1. Do 083 `setServerVoiceId` wołał **wyłącznie** asystent, a `serverVoiceId` jest zmienną
   *    modułową w `lib/tts`. Lektor Wiadomości dziedziczył ją więc PRZYPADKIEM: szedł głosem
   *    serwerowym, jeśli użytkownik otworzył wcześniej asystenta w tej samej sesji strony, a
   *    przeglądarką, jeśli nie. Nikt tego nie zaprojektował — tak wyszło.
   * 2. Gdy głos serwerowy jest ustawiony, PIERWSZE zdanie szło do sieci, a po odmowie synteza
   *    przeglądarki startowała już po `await` — czyli poza gestem użytkownika, gdzie WebKit odrzuca
   *    ją bez żadnego zdarzenia. Zatrzask z 080 ratował dopiero DRUGIE zdanie, którego nigdy nie
   *    było, bo łańcuch stał na pierwszym.
   *
   * Dlatego dostępność rozstrzygamy przy montowaniu (`getSpeechOptions` — bez syntezy, bez dźwięku).
   * Gdy dostawca jest nieskonfigurowany, zostajemy przy głosie przeglądarki od razu, więc pierwsze
   * zdanie rusza SYNCHRONICZNIE w geście dotknięcia — i po prostu gra.
   */
  /**
   * 084 (recenzja): czy USTAWIENIA GŁOSU są już rozstrzygnięte.
   *
   * Autostart czekał wcześniej tylko na montaż, a konfiguracja jest asynchroniczna — więc pierwsze
   * zdanie ruszało głosem przeglądarki, a wybrany głos serwerowy wchodził dopiero od drugiego.
   * Słychać to jako zmianę lektora w połowie pierwszej wiadomości.
   */
  const [glosGotowy, setGlosGotowy] = useState(false);

  useEffect(() => {
    let anulowane = false;
    (async () => {
      try {
        const p = await getAssistantPrefs();
        if (anulowane) return;
        setRate(p.readerRate);
        setSpeechRate(p.readerRate);

        if (p.voiceKind === "server" && p.voiceId) {
          const opcje = await getSpeechOptions().catch(() => ({ serverAvailable: false, voices: [] }));
          if (anulowane) return;
          // Głos serwerowy bierzemy TYLKO wtedy, gdy dostawca faktycznie jest skonfigurowany.
          setServerVoiceId(opcje.serverAvailable ? p.voiceId : null);
        } else {
          setServerVoiceId(null);
        }
      } catch {
        /* brak ustawień nie może zepsuć lektora — zostajemy przy domyślnych i głosie przeglądarki */
        if (!anulowane) setServerVoiceId(null);
      } finally {
        if (!anulowane) setGlosGotowy(true);
      }
    })();
    return () => {
      anulowane = true;
    };
  }, []);

  function zmienPredkosc(next: number) {
    setRate(next);
    setSpeechRate(next); // działa od razu, także w trakcie czytania
    void updateAssistantPrefs({ readerRate: next }).catch(() => {});
  }

  useEffect(() => {
    setSupported(speechAvailable());
  }, []);


  /** Ucisza TEN lektor. Tożsamość jest stała, więc nadaje się na klucz w rejestrze globalnym. */
  const silence = useCallback(() => {
    activeRef.current = false;
    stopSpeaking();
    setCurrent(null);
    setPaused(false);
    setCisza(null);
    indexRef.current = 0;
  }, []);

  // Wyjście ze strony/odmontowanie nie może zostawić mówiącego lektora.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      releaseSpeech(silence);
      stopSpeaking();
    };
  }, [silence]);

  // 044: zmiana zestawu bloków (np. przełączenie lektora tematu na inny temat) musi uciszyć
  // poprzedni odczyt — inaczej dwa głosy nakładałyby się na siebie.
  //
  // Zależność to PODPIS TREŚCI, nie tożsamość tablicy: gdyby konsument budował `blocks` w ciele
  // komponentu, każdy render dawałby nową tablicę i lektor milkłby sam z siebie po pierwszym
  // zdaniu. Podpis zmienia się dopiero wtedy, gdy naprawdę zmienia się zestaw wiadomości.
  //
  // 111: PODPIS OBEJMUJE TAKŻE TREŚĆ, nie tylko tytuły.
  //
  // Zgłoszenie właściciela: „jeśli wiadomość streszczę na inny poziom, to lektor i tak będzie
  // czytał ten pierwszy streszczony tekst". Tytuł przy zmianie poziomu streszczenia **się nie
  // zmienia**, więc podpis liczony z samych tytułów był identyczny, ten efekt się nie budził
  // i lektor czytał dalej zdania sprzed zmiany. Podpis nazywał się „podpisem TREŚCI", a treści
  // nie obejmował — to jest cała usterka.
  const blocksKey = useMemo(() => podpisBlokow(blocks), [blocks]);
  /** Treść zdania czytanego ostatnio — po zmianie zestawu szukamy go w nowej liście. */
  const ostatnieZdanie = useRef<string | null>(null);
  /** Tytuł bloku, w którym byliśmy — ratunek, gdy zdanie zniknęło, ale wiadomość została. */
  const ostatniTytul = useRef<string | null>(null);
  const pierwszyZestaw = useRef(true);
  useEffect(() => {
    // Pierwszy przebieg to montaż — nie ma czego uciszać, a start należy do autostartu.
    if (pierwszyZestaw.current) {
      pierwszyZestaw.current = false;
      return;
    }
    /**
     * 084 (recenzja): zmiana zestawu NIE przewija odsłuchu na początek.
     *
     * Zestaw zmienia się także wtedy, gdy słuchacz oznaczy wiadomość jako przeczytaną — a wcześniej
     * autostart odpalał wtedy odsłuch od zera i cała porcja leciała od nowa. Szukamy tego samego
     * ZDANIA w nowej liście: jeśli jest, czytamy dalej od niego; jeśli zniknęło (odrzucono właśnie
     * czytaną wiadomość), po prostu milkniemy — zgadywanie następnika byłoby gorsze niż cisza.
     */
    const graloPrzed = activeRef.current;
    const tekst = ostatnieZdanie.current;
    const tytul = ostatniTytul.current;
    silence();
    releaseSpeech(silence);
    lastReportedBlock.current = null;
    if (!graloPrzed || !tekst) return;
    const i = sentences.findIndex((x) => x.text === tekst);
    if (i >= 0) {
      playFromRef.current?.(i);
      return;
    }
    /**
     * 111: ZDANIE ZNIKŁO, ALE WIADOMOŚĆ ZOSTAŁA — czytamy ją od nowa, zamiast milknąć.
     *
     * To są dwie różne sytuacje i do 111 obie kończyły się ciszą. Gdy słuchacz oznaczy wiadomość
     * jako przeczytaną, wypada ona z zestawu i cisza jest właściwa (decyzja z 084: zgadywanie
     * następnika byłoby gorsze). Ale gdy zmieni się POZIOM STRESZCZENIA, wiadomość zostaje —
     * zmienia się tylko jej treść, więc czytanie jej nowej wersji od początku nie jest zgadywaniem.
     *
     * Rozróżniamy je po tytule bloku: tytuł przeżywa zmianę poziomu i ginie razem z wiadomością.
     */
    if (!tytul) return;
    const j = sentences.findIndex((x) => blocks[x.block]?.title === tytul);
    if (j >= 0) playFromRef.current?.(j);
  }, [blocksKey, sentences, blocks, silence]);

  const playFrom = useCallback(
    (index: number) => {
      if (index < 0 || index >= sentences.length) {
        activeRef.current = false;
        setCurrent(null);
        setPaused(false);
        return;
      }
      indexRef.current = index;
      activeRef.current = true;
      ostatnieZdanie.current = sentences[index].text;
      // 111: zapamiętujemy też, w KTÓREJ wiadomości jesteśmy — po zmianie poziomu streszczenia
      // zdania już nie będzie, a tytuł zostanie i po nim wracamy do tej samej wiadomości.
      ostatniTytul.current = blocks[sentences[index].block]?.title ?? null;
      // Zgłaszamy się jako jedyny grający lektor — każdy inny zostaje uciszony (patrz `claimSpeech`).
      claimSpeech(silence);
      setCurrent(index);
      setPaused(false);
      setCisza(null);

      /**
       * 084 (AC-8): PRZERWA NA GRANICY WIADOMOŚCI.
       *
       * Bez niej ostatnie zdanie jednej wiadomości i tytuł następnej zlewają się w jedno zdanie,
       * a słuchacz nie ma jak usłyszeć, że temat się zmienił. Stała, bez ustawienia: suwak do
       * regulowania ciszy to kontrolka, której nikt nie dotknie drugi raz (C-53).
       */
      const poprzednie = index > 0 ? sentences[index - 1] : null;
      const granica = poprzednie != null && poprzednie.block !== sentences[index].block;

      const powiedz = () => {
        if (!activeRef.current || indexRef.current !== index) return;
        speak(sentences[index].text, "pl", {
          onEnd: () => {
            // Zatrzymanie/przeskok w międzyczasie unieważnia ten łańcuch.
            if (!activeRef.current || indexRef.current !== index) return;
            playFrom(index + 1);
          },
          /**
           * 084 (AC-2): urządzenie nie wydało dźwięku. Zatrzymujemy łańcuch i MÓWIMY o tym —
           * przelatywanie dalej w milczeniu przy rosnącym liczniku było sednem zgłoszenia.
           */
          onSilent: () => {
            if (!activeRef.current || indexRef.current !== index) return;
            activeRef.current = false;
            setPaused(false);
            setCisza(t("ciszaOpis"));
          },
        });
      };

      if (granica) window.setTimeout(powiedz, PRZERWA_MIEDZY_WIADOMOSCIAMI_MS);
      else powiedz();
    },
    [sentences, blocks, silence, t]
  );
  /**
   * Efekt zmiany zestawu jest zadeklarowany WYŻEJ, więc sięga po tę funkcję przez ref. Wpięcie jej
   * wprost w zależności tamtego efektu kazałoby mu przeliczać się przy każdej zmianie listy zdań,
   * czyli dokładnie wtedy, gdy ma zdecydować, czy czytać dalej.
   */
  const playFromRef = useRef<((index: number) => void) | null>(null);
  playFromRef.current = playFrom;

  /**
   * 084 (AC-10): start przy otwarciu — DOKŁADNIE RAZ.
   *
   * Dwie poprawki po recenzji. Start czeka na `glosGotowy`, żeby pierwsze zdanie poszło już wybranym
   * głosem, a nie zapasowym głosem przeglądarki (słychać to jako zmianę lektora w połowie zdania).
   * I odpala się raz na otwarcie, a nie przy każdej zmianie zestawu — przełączenie odsłuchu na inny
   * temat konsument wymusza przez `key` (przemontowanie), a zmiana listy w trakcie słuchania jest
   * obsłużona wyżej: czytamy dalej od tego samego zdania.
   */
  /**
   * Czy lektor faktycznie czyta. Liczone PRZED wczesnymi wyjściami, bo zgłaszamy to na zewnątrz
   * hookiem, a hook po `return` byłby złamaniem reguł Reacta.
   */
  const playing = current != null && !paused;
  useEffect(() => {
    onGra?.(playing);
  }, [playing, onGra]);
  // Odmontowanie lektora = koniec czytania, choćby stan mówił co innego.
  useEffect(() => () => onGra?.(false), [onGra]);

  const autoStartRef = useRef(autoStart);
  autoStartRef.current = autoStart;
  const wystartowano = useRef(false);
  useEffect(() => {
    if (!autoStartRef.current || wystartowano.current || !glosGotowy) return;
    wystartowano.current = true;
    playFrom(0);
  }, [glosGotowy, playFrom]);

  /**
   * 084 (AC-5): przewijania WEWNĄTRZ lektora już nie ma, bo nie ma czego przewijać — lista zdań
   * zniknęła razem z pudełkiem. Czytany fragment podświetla się teraz w karcie wiadomości, a za
   * przewinięcie widoku do niej odpowiada `onBlockChange`, czyli rama widoku.
   *
   * To domyka zgłoszenie z 080/Z12 („scroluje do wiadomości, po czym wraca do góry lektora") od
   * strony przyczyny, a nie objawu: dwa mechanizmy nie mogą już walczyć o ten sam ekran, bo drugi
   * przestał istnieć.
   */

  // 044: przejście do innej wiadomości zgłaszamy na zewnątrz, żeby strumień mógł przewinąć stronę
  // do czytanej karty. Wywołujemy TYLKO przy faktycznej zmianie bloku, nie przy każdym zdaniu.
  const currentBlock = current == null ? null : sentences[current]?.block ?? null;
  // 084 (AC-5): czytane zdanie idzie na zewnątrz przy KAŻDEJ zmianie — to ono podświetla się
  // w karcie. Blok zgłaszamy osobno (niżej), bo przewinięcie ma nastąpić raz na wiadomość, a nie
  // raz na zdanie.
  useEffect(() => {
    onCzytaneZdanie?.(current == null ? null : sentences[current]?.text ?? null, currentBlock);
  }, [current, currentBlock, sentences, onCzytaneZdanie]);

  useEffect(() => {
    if (currentBlock == null || currentBlock === lastReportedBlock.current) return;
    lastReportedBlock.current = currentBlock;
    // 080 (Z12): przewinięcie STRONY do czytanej wiadomości jest teraz wyborem użytkownika.
    // Wyłączony przełącznik oznacza, że strona nie rusza się w ogóle — można czytać jedną rzecz
    // i słuchać innej, zamiast być ciągle ściąganym w dół.
    if (followRef.current) onBlockChange?.(currentBlock);
  }, [currentBlock, onBlockChange]);

  function start() {
    // iOS przepuszcza mowę tylko z gestu użytkownika — odblokowanie musi być TU, w obsłudze kliknięcia.
    primeSpeech();
    playFrom(current ?? 0);
  }

  function togglePause() {
    if (paused) {
      // Wznowienie = ponowne odczytanie bieżącego zdania. Świadomie nie korzystamy z `pause()`
      // syntezy: na iOS potrafi ono zamilknąć na dobre, a powtórzone zdanie to koszt, który
      // słychać raz, w przeciwieństwie do lektora, który przestał działać.
      playFrom(indexRef.current);
      return;
    }
    activeRef.current = false;
    stopSpeaking();
    setPaused(true);
  }

  function stop() {
    silence();
    releaseSpeech(silence);
  }

  function step(delta: number) {
    const next = Math.min(Math.max((current ?? 0) + delta, 0), sentences.length - 1);
    primeSpeech();
    playFrom(next);
  }

  /** Skok o całą wiadomość — do pierwszego zdania sąsiedniego bloku. */
  function stepBlock(delta: number) {
    const from = currentBlock ?? 0;
    const target = Math.min(Math.max(from + delta, 0), blocks.length - 1);
    const index = sentences.findIndex((s) => s.block === target);
    if (index < 0) return;
    primeSpeech();
    playFrom(index);
  }

  if (sentences.length === 0) return null;

  if (!supported) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        {t("taPrzegladarkaNieObsluguje")}
      </p>
    );
  }

  // Numeracja zdania liczona W OBRĘBIE wiadomości — „zdanie 3/5 tej wiadomości" niesie sens,
  // „zdanie 212/540 całego strumienia" nie niesie żadnego.
  const blockSentences = currentBlock == null ? [] : sentences.filter((s) => s.block === currentBlock);
  const sentenceInBlock =
    current == null || currentBlock == null
      ? 0
      : sentences.slice(0, current + 1).filter((s) => s.block === currentBlock).length;

  return (
    /**
     * 084 (AC-4, AC-5): LEKTOR TO JUŻ SAM PASEK STEROWANIA.
     *
     * Zniknęła lista zdań, która powtarzała treść wiadomości gołym tekstem — właściciel zgłosił to
     * wprost: „lektor nie miał pokazywać swojego okna z tekstem, tylko być przyklejony i pokazywać
     * czytane elementy bezpośrednio w miejscach tych elementów". Czytany fragment podświetla się
     * teraz w karcie wiadomości; tutaj zostaje wyłącznie to, czym się steruje.
     *
     * `sticky bottom-0` względem RAMY WIDOKU — pasek jest w zasięgu kciuka przez cały czas
     * przewijania i nie chowa się pod paskiem systemowym telefonu (C-31).
     */
    <div
      // Uchwyt dla klikacza: przyklejenie paska jest przedmiotem AC-4, a klasy Tailwinda nie są
      // kontraktem. Ten sam wzorzec co `data-news-pasek` dla paska nawigacji.
      data-news-lektor
      /**
       * 084 (AC-4): pasek stoi przy DOLNEJ KRAWĘDZI EKRANU przez cały czas przewijania.
       *
       * Świadomie `fixed`, a nie `sticky`. `sticky bottom-0` na końcu długiej treści przykleja się
       * dopiero wtedy, gdy przewiniemy do jego miejsca w przepływie — czyli dokładnie wtedy, gdy
       * już go nie potrzebujemy. Zmierzone: przy wejściu na stronę pasek był 4000 px poniżej ekranu.
       *
       * Lewy odstęp bierzemy ze zmiennej `--sidebar-width`, a nie z wpisanej liczby: pasek boczny
       * jest `hidden md:flex`, więc na telefonie odstęp musi być zerowy, a jego szerokość i tak
       * zmienia się razem ze skórką.
       *
       * **Dolny odstęp na telefonie jest równie konieczny (recenzja 084).** Powłoka ma tam własny,
       * przyklejony pasek zakładek (`AppShell`, `z-40`, wysokość `56px + safe-area`). Pasek lektora
       * z `bottom-0` i `z-30` renderował się DOKŁADNIE pod nim: niewidoczny i nieklikalny, więc
       * Pauzy ani Stopu nie dało się dosięgnąć — czyli AC-4 na docelowym urządzeniu nie działało.
       * Odsuwamy się o jego wysokość zamiast przykrywać go wyższą warstwą: nawigacja aplikacji jest
       * ważniejsza od sterowania odsłuchem i nie wolno jej zasłaniać.
       */
      className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-[var(--border)] bg-[var(--bg-surface)] shadow-lg md:bottom-0 md:left-[var(--sidebar-width)]"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      {/* 084 (AC-2): stan ciszy zamiast udawania. Gdy urządzenie nie wydało dźwięku, pasek MÓWI
          o tym i daje wyjście — kliknięcie „Odtwórz ponownie" JEST gestem użytkownika, a ścieżka
          serwerowa jest już wtedy zatrzaśnięta, więc synteza rusza synchronicznie i gra. */}
      {cisza && (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-xs"
          style={{ color: "var(--accent-amber)" }}
          role="status"
        >
          <Ban size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{cisza}</span>
          <button
            onClick={() => {
              setCisza(null);
              primeSpeech();
              playFrom(indexRef.current);
            }}
            className="shrink-0 rounded-md px-2 py-2 text-[var(--text-primary)] underline-offset-2 hover:underline"
          >
            {t("odtworzPonownie")}
          </button>
        </div>
      )}
      {/* Pasek sterowania przyklejony do dołu karty — na telefonie musi być w zasięgu kciuka i nie
          może chować się pod paskiem systemowym (C-31).

          080 (Z12): zawijanie tylko na WĄSKIM ekranie. Wcześniej `flex-wrap` obowiązywał zawsze,
          więc na komputerze pasek rozbijał się na kilka rzędów, które przy przewijaniu strony
          przyklejały się jeden po drugim — stąd zgłoszenie „jakoś dziwnie przypinają się elementy
          strony". Od `sm` mamy jeden rząd z grupami: nawigacja · odtwarzanie · prędkość · podążanie. */}
      <div
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-2 py-2 sm:flex-nowrap"
      >
        {/* Skok o całą wiadomość pojawia się tylko wtedy, gdy jest po czym skakać — przy jednym
            bloku pasek zostaje dokładnie taki, jaki był przed 044. */}
        {multi && (
          <ReaderButton
            onClick={() => stepBlock(-1)}
            label={t("poprzedniaWiadomosc")}
            disabled={current == null || (currentBlock ?? 0) <= 0}
          >
            <ChevronLeft size={16} />
          </ReaderButton>
        )}
        <ReaderButton onClick={() => step(-1)} label="Poprzednie zdanie" disabled={current == null}>
          <SkipBack size={16} />
        </ReaderButton>
        {current == null ? (
          <ReaderButton onClick={start} label={t("czytajNaGlos")} primary>
            <Volume2 size={16} />
            <span className="text-xs">Czytaj</span>
          </ReaderButton>
        ) : (
          <ReaderButton onClick={togglePause} label={playing ? "Wstrzymaj" : "Wznów"} primary>
            {playing ? <Pause size={16} /> : <Play size={16} />}
            <span className="text-xs">{playing ? "Pauza" : "Wznów"}</span>
          </ReaderButton>
        )}
        <ReaderButton
          onClick={() => step(1)}
          label={t("nastepneZdanie")}
          disabled={current == null || current >= sentences.length - 1}
        >
          <SkipForward size={16} />
        </ReaderButton>
        {multi && (
          <ReaderButton
            onClick={() => stepBlock(1)}
            label={t("nastepnaWiadomosc")}
            disabled={current == null || (currentBlock ?? 0) >= blocks.length - 1}
          >
            <ChevronRight size={16} />
          </ReaderButton>
        )}
        <ReaderButton onClick={stop} label="Zatrzymaj" disabled={current == null}>
          <Square size={16} />
        </ReaderButton>
        {onZamknij && (
          <ReaderButton
            onClick={() => {
              stop();
              onZamknij();
            }}
            label={t("zamknijLektora")}
          >
            <X size={16} />
          </ReaderButton>
        )}

        {/* 080 (Z12): PRĘDKOŚĆ. Suwak, nie lista wartości — użytkownik dobiera ją słuchem,
            a nie wybiera z katalogu. Wartość działa natychmiast, także w trakcie czytania. */}
        <label className="ml-1 flex items-center gap-1.5" title={t("predkoscCzytania")}>
          <Gauge size={14} className="shrink-0 text-[var(--text-muted)]" />
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={rate}
            onChange={(e) => zmienPredkosc(Number(e.target.value))}
            aria-label={t("predkoscCzytania")}
            className="w-16 sm:w-20"
            style={{ accentColor: "var(--accent-blue)" }}
          />
          <span className="w-8 shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
            {rate.toFixed(2).replace(/0$/, "")}×
          </span>
        </label>

        {/* 080 (Z12): PODĄŻANIE ZA CZYTANIEM. Wyłączone = strona nie rusza się w ogóle, więc da
            się czytać jedno, a słuchać drugiego. */}
        <ReaderButton
          onClick={() => onPodazanie?.(!podazanie)}
          label={podazanie ? t("wylaczPodazanie") : t("wlaczPodazanie")}
          primary={podazanie}
        >
          {podazanie ? <Crosshair size={16} /> : <Ban size={16} />}
        </ReaderButton>

        <span className="ml-auto whitespace-nowrap pr-1 text-[11px] text-[var(--text-muted)]">
          {current == null
            ? multi
              ? `${blocks.length} wiadomości · ${sentences.length} zdań`
              : `${sentences.length} zdań`
            : multi
              ? `wiadomość ${(currentBlock ?? 0) + 1}/${blocks.length} · zdanie ${sentenceInBlock}/${blockSentences.length}`
              : `${current + 1}/${sentences.length}`}
        </span>
      </div>
    </div>
  );
}

function ReaderButton({
  onClick,
  label,
  children,
  disabled,
  primary,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      // Na telefonie pierwszy dotyk musi wykonać akcję, a nie tylko przenieść fokus — stąd
      // obsługa w `onPointerDown` z zablokowaniem domyślnego zachowania.
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      onClick={(e) => e.preventDefault()}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-3 transition-colors disabled:opacity-40",
        primary
          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}
