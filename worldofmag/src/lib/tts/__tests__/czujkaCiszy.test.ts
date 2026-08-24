import { test } from "node:test";
import assert from "node:assert/strict";
import { speak, setServerVoiceId } from "@/lib/tts";

/**
 * 084 (AC-2) — CISZA BEZ KOMUNIKATU JEST NIEMOŻLIWA.
 *
 * Zgłoszenie właściciela: „niby leci a nie słyszę". Przyczyna, której poprzednie zabezpieczenia nie
 * łapały: iOS odrzuca `speechSynthesis.speak()` wywołane poza gestem użytkownika **bez żadnego
 * zdarzenia** — nie ma `onstart`, `onend` ani `onerror`. Lektor łańcuchuje zdania po `onEnd`, więc
 * łańcuch zamiera, a licznik na ekranie dalej pokazuje postęp.
 *
 * Czujka nie zna przyczyny milczenia i to jest jej wartość: łapie także powody, których nie
 * przewidzieliśmy. Te testy pilnują obu stron: cisza MA być zgłoszona, a działająca mowa NIE MOŻE
 * być zgłoszona jako cisza.
 */

/** Synteza, która przyjmuje wypowiedź i nic nie robi — odwzorowanie ciszy na iOS. */
function milczacaSynteza() {
  return {
    speaking: false,
    paused: false,
    pending: false,
    speak: () => {},
    cancel: () => {},
    resume: () => {},
    pause: () => {},
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    onvoiceschanged: null,
  } as unknown as SpeechSynthesis;
}

/** Synteza, która uczciwie zgłasza start i koniec. */
function dzialajacaSynteza() {
  return {
    speaking: false,
    paused: false,
    pending: false,
    speak: (u: SpeechSynthesisUtterance) => {
      setTimeout(() => u.onstart?.(new Event("start") as SpeechSynthesisEvent), 5);
      setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 15);
    },
    cancel: () => {},
    resume: () => {},
    pause: () => {},
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    onvoiceschanged: null,
  } as unknown as SpeechSynthesis;
}

function zSynteza<T>(synteza: SpeechSynthesis | undefined, fn: () => Promise<T>): Promise<T> {
  const okno = globalThis as unknown as {
    window?: unknown;
    speechSynthesis?: SpeechSynthesis;
    SpeechSynthesisUtterance?: unknown;
  };
  const poprzednie = okno.speechSynthesis;
  const bylWindow = okno.window;
  okno.window = okno;
  // `ttsSupported()` pyta `"speechSynthesis" in window`, więc PRAWDZIWY brak wsparcia to usunięty
  // klucz. Przypisanie `undefined` zostawia klucz i opisuje inną sytuację: syntezę niesprawną.
  if (synteza) okno.speechSynthesis = synteza;
  else delete okno.speechSynthesis;
  okno.SpeechSynthesisUtterance = class {
    text: string;
    lang = "";
    rate = 1;
    volume = 1;
    voice: unknown = null;
    onstart: ((e: unknown) => void) | null = null;
    onend: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  return fn().finally(() => {
    if (poprzednie) okno.speechSynthesis = poprzednie;
    else delete okno.speechSynthesis;
    okno.window = bylWindow;
  });
}

test("synteza, która nic nie robi, jest zgłaszana jako CISZA — nie jako przeczytane", async () => {
  setServerVoiceId(null);
  await zSynteza(milczacaSynteza(), async () => {
    let cisza = 0;
    let koniec = 0;
    speak("Zdanie, którego nikt nie usłyszy.", "pl", {
      onEnd: () => koniec++,
      onSilent: () => cisza++,
    });
    await new Promise((r) => setTimeout(r, 1700));
    assert.equal(cisza, 1, "brak startu mowy musi zostać zgłoszony");
    assert.equal(koniec, 0, "cisza NIE może udawać przeczytanego zdania — inaczej łańcuch leci dalej");
  });
});

test("działająca mowa NIE jest zgłaszana jako cisza", async () => {
  setServerVoiceId(null);
  await zSynteza(dzialajacaSynteza(), async () => {
    let cisza = 0;
    let koniec = 0;
    speak("To zdanie się odezwie.", "pl", {
      onEnd: () => koniec++,
      onSilent: () => cisza++,
    });
    await new Promise((r) => setTimeout(r, 1700));
    assert.equal(koniec, 1, "zakończona wypowiedź napędza łańcuch");
    assert.equal(cisza, 0, "fałszywy alarm ciszy byłby gorszy niż jej brak");
  });
});

test("brak syntezy w ogóle to CISZA, a nie „przeczytane”", async () => {
  setServerVoiceId(null);
  await zSynteza(undefined, async () => {
    let cisza = 0;
    let koniec = 0;
    speak("Urządzenie bez syntezy.", "pl", { onEnd: () => koniec++, onSilent: () => cisza++ });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(cisza, 1);
    assert.equal(koniec, 0, "inaczej lektor przelatuje całą porcję w milczeniu, pokazując postęp");
  });
});

test("konsument bez `onSilent` zachowuje dawne zachowanie", async () => {
  setServerVoiceId(null);
  await zSynteza(undefined, async () => {
    let koniec = 0;
    speak("Bez czujki.", "pl", { onEnd: () => koniec++ });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(koniec, 1, "nagła zmiana byłaby regresją dla konsumentów, którzy pytają tylko o koniec");
  });
});

test("niesprawna synteza (wyjątek) też jest ciszą — i to od razu, bez czekania na czujkę", async () => {
  setServerVoiceId(null);
  const zepsuta = {
    speak: () => {
      throw new Error("synteza niesprawna");
    },
    cancel: () => {},
    resume: () => {},
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as SpeechSynthesis;
  await zSynteza(zepsuta, async () => {
    let cisza = 0;
    let koniec = 0;
    speak("Zdanie w próżnię.", "pl", { onEnd: () => koniec++, onSilent: () => cisza++ });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(cisza, 1, "wyjątek z syntezy to cisza zgłoszona natychmiast");
    assert.equal(koniec, 0);
  });
});

test("WOLNY głos serwerowy nie jest zgłaszany jako cisza (recenzja 084)", async () => {
  /**
   * Regresja znaleziona w recenzji: czujka uzbrajała się PRZED żądaniem do `/api/tts`, więc 1,5 s
   * musiało wystarczyć na limiter, sieć, syntezę u dostawcy i start odtwarzania. Typowa odpowiedź
   * przychodzi po ~2 s — lektor zatrzymywał wtedy łańcuch i pokazywał „nie odtworzyło dźwięku",
   * a chwilę później dźwięk ruszał. Użytkownik słyszał JEDNO zdanie i komunikat o awarii, której
   * nie było.
   */
  const oryginalnyFetch = globalThis.fetch;
  // Odpowiedź wolniejsza niż okno czujki, ale POPRAWNA.
  globalThis.fetch = (async () => {
    await new Promise((r) => setTimeout(r, 1800));
    return {
      ok: true,
      status: 200,
      blob: async () => ({ type: "audio/mpeg" }),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  setServerVoiceId("wolny-glos");
  try {
    /**
     * W Node nie ma elementu `Audio`, więc ścieżka serwerowa i tak spadnie na przeglądarkę —
     * sprawdzamy więc własność, która JEST sednem naprawy i daje się tu zmierzyć: czujka nie może
     * orzec ciszy, ZANIM żądanie do dostawcy się rozstrzygnie. Przed poprawką alarm szedł po
     * 1,5 s, czyli w trakcie oczekiwania na odpowiedź; po poprawce najwcześniej po niej.
     */
    const start = Date.now();
    let kiedyCisza: number | null = null;
    speak("Zdanie czytane wolnym głosem serwerowym.", "pl", {
      onSilent: () => {
        kiedyCisza ??= Date.now() - start;
      },
    });
    await new Promise((r) => setTimeout(r, 2600));
    assert.ok(
      kiedyCisza === null || kiedyCisza >= 1800,
      `czujka orzekła ciszę po ${kiedyCisza} ms — czyli w trakcie oczekiwania na dostawcę, ` +
        "a to ucina odsłuch po pierwszym zdaniu przy w pełni sprawnym głosie",
    );
  } finally {
    globalThis.fetch = oryginalnyFetch;
    setServerVoiceId(null);
  }
});
