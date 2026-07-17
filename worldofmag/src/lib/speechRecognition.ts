// L1: rozpoznawanie mowy przez Web Speech API (SpeechRecognition) — bez sieci/zależności.
// Warstwa nasłuchu dla trybu rozmowy głosowej z Asystentem (patrz AICommandSheet).
// Świadomie NIE ruszamy własnej implementacji w SmartTextarea (dyktowanie do pola działa) —
// tu potrzebujemy modelu „jedna wypowiedź → cisza kończy → oddaj transkrypt", stąd osobny helper
// na wzór @/lib/tts.

interface ISpeechResult {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}
interface ISpeechError { error: string }
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: ISpeechResult) => void) | null;
  onerror: ((e: ISpeechError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface ISpeechRecognitionCtor { new(): ISpeechRecognition }

// Odczyt konstruktora bez augmentacji globalnego `Window` — inne pliki (SmartTextarea,
// AITaskInput) deklarują własną, węższą wersję tego samego pola, a globalne złączenie z naszym
// szerszym typem (z `abort()`) powodowałoby kolizję deklaracji. Dlatego czytamy lokalnym rzutem.
interface SpeechCapableWindow {
  SpeechRecognition?: ISpeechRecognitionCtor;
  webkitSpeechRecognition?: ISpeechRecognitionCtor;
}
function getRecognitionCtor(): ISpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as SpeechCapableWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

/** Czy rozpoznawanie mowy jest dostępne w tej przeglądarce. */
export function speechRecognitionSupported(): boolean {
  return !!getRecognitionCtor();
}

export interface SpeechListenerOptions {
  /** Język rozpoznawania (BCP-47). Domyślnie polski. */
  lang?: string;
  /** Częściowy (interim) transkrypt na żywo — do podglądu w UI. Opcjonalny. */
  onInterim?: (text: string) => void;
  /** Finalny transkrypt po naturalnym zakończeniu nasłuchu (cisza) lub `stop()`. Pusty, gdy nic nie wypowiedziano. */
  onFinal: (text: string) => void;
  /** Błąd mikrofonu/rozpoznawania (np. brak zgody). */
  onError?: (error: string) => void;
}

export interface SpeechListener {
  /** Rozpocznij nasłuch pojedynczej wypowiedzi. */
  start(): void;
  /** Zakończ łagodnie — dostarczy `onFinal` z tym, co zebrano. */
  stop(): void;
  /** Przerwij twardo — odrzuca wynik, `onFinal` NIE zostanie wywołany (np. wyłączenie trybu). */
  abort(): void;
}

/**
 * Tworzy listener rozpoznawania mowy w modelu „jedna tura": start → mówisz → cisza kończy →
 * `onFinal(transkrypt)`. Bezpieczny no-op bez wsparcia przeglądarki (start/stop/abort nic nie robią).
 */
export function createSpeechListener(opts: SpeechListenerOptions): SpeechListener {
  const SR = getRecognitionCtor();
  if (!SR) {
    return { start() {}, stop() {}, abort() {} };
  }

  let rec: ISpeechRecognition | null = null;
  let finalText = "";
  let lastInterim = "";
  let aborted = false;
  let delivered = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  // KLUCZOWE dla iOS Safari: `continuous=false` NIE zatrzymuje niezawodnie rozpoznawania po ciszy
  // (mikrofon zostaje otwarty, `onend` nie odpala, `isFinal` bywa nigdy nieustawione). Dlatego sami
  // wykrywamy koniec tury: po pauzie (SILENCE) domykamy turę i dostarczamy tekst (final ALBO interim).
  const SILENCE_MS = 1500;   // brak nowej mowy przez tyle → koniec wypowiedzi
  const NO_SPEECH_MS = 8000; // nic nie powiedziano → oddaj pustą turę (pętla ponowi nasłuch)

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }
  function armTimer(ms: number) {
    clearTimer();
    timer = setTimeout(finishBySilence, ms);
  }
  function cleanup() {
    clearTimer();
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec = null;
    }
  }
  // Domknięcie tury z najlepszym dostępnym tekstem (final, a gdy iOS nie oznaczył — ostatni interim).
  function deliver() {
    if (aborted || delivered) return;
    delivered = true;
    const text = (finalText.trim() || lastInterim.trim());
    clearTimer();
    opts.onFinal(text);
  }
  function finishBySilence() {
    if (aborted || delivered) return;
    const r = rec;
    cleanup();
    try { r?.stop(); } catch { /* ignore */ } // zwolnij mikrofon; onend (jeśli odpali) już bez efektu
    deliver();
  }

  return {
    start() {
      // Nie nakładaj dwóch nasłuchów naraz.
      if (rec) return;
      finalText = "";
      lastInterim = "";
      aborted = false;
      delivered = false;
      const r = new SR();
      r.lang = opts.lang ?? "pl-PL";
      r.continuous = false;
      r.interimResults = true;
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += chunk + " ";
          else interim += chunk;
        }
        if (interim) lastInterim = interim;
        opts.onInterim?.(interim);
        // Każdy wynik = użytkownik mówi → reset licznika ciszy (domknij dopiero po pauzie).
        armTimer(SILENCE_MS);
      };
      r.onerror = (e) => {
        // „no-speech"/„aborted" to normalne zakończenia bez treści — nie hałasuj.
        if (e.error !== "no-speech" && e.error !== "aborted") opts.onError?.(e.error);
      };
      r.onend = () => {
        // Chrome zwykle domyka tu sam po ciszy; iOS bywa, że nie — mamy wtedy timer ciszy.
        cleanup();
        deliver();
      };
      rec = r;
      try {
        r.start();
        // Zabezpieczenie: jeśli nic nie zostanie wypowiedziane, nie trzymaj mikrofonu w nieskończoność.
        armTimer(NO_SPEECH_MS);
      } catch {
        // np. start() wywołany zbyt szybko po poprzednim — traktuj jak brak wyniku.
        cleanup();
        if (!aborted && !delivered) { delivered = true; opts.onFinal(""); }
      }
    },
    stop() {
      rec?.stop();
    },
    abort() {
      aborted = true;
      clearTimer();
      const r = rec;
      cleanup();
      r?.abort();
    },
  };
}
