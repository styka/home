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
  let aborted = false;
  let delivered = false;

  function cleanup() {
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec = null;
    }
  }

  return {
    start() {
      // Nie nakładaj dwóch nasłuchów naraz.
      if (rec) return;
      finalText = "";
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
        opts.onInterim?.(interim);
      };
      r.onerror = (e) => {
        // „no-speech"/„aborted" to normalne zakończenia bez treści — nie hałasuj.
        if (e.error !== "no-speech" && e.error !== "aborted") opts.onError?.(e.error);
      };
      r.onend = () => {
        cleanup();
        if (aborted || delivered) return;
        delivered = true;
        opts.onFinal(finalText.trim());
      };
      rec = r;
      try {
        r.start();
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
      const r = rec;
      cleanup();
      r?.abort();
    },
  };
}
