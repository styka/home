"use client";

// Dyktowanie mowy → tekst (Web Speech, ciągłe rozpoznawanie) dla composera Asystenta.
// Świadomie odrębne od `lib/speechRecognition.ts` (tam: model „jedna tura, cisza kończy" dla
// ROZMOWY głosowej) — dyktowanie ma dopisywać kolejne wypowiedzi do pola, dopóki użytkownik nie
// wyłączy mikrofonu. Wzorowane na wbudowanym dyktowaniu w SmartTextarea, ale wystawione jako
// pojedynczy przycisk mikrofonu w pigułce (jak w ChatGPT), obok pola tekstowego.

import { useCallback, useEffect, useRef, useState } from "react";

interface ISpeechResult {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: ISpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface ISpeechRecognitionCtor { new (): ISpeechRecognition }

// Lokalny rzut zamiast augmentacji globalnego `Window` (jak w lib/speechRecognition.ts) — inne pliki
// deklarują własną, węższą wersję tego pola i globalne złączenie powodowałoby kolizję deklaracji.
function getRecognitionCtor(): ISpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: ISpeechRecognitionCtor;
    webkitSpeechRecognition?: ISpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export interface Dictation {
  /** Czy przeglądarka wspiera rozpoznawanie mowy. */
  supported: boolean;
  /** Czy trwa dyktowanie. */
  recording: boolean;
  /** Włącz/wyłącz dyktowanie (start w geście użytkownika — wymóg iOS/Safari). */
  toggle: () => void;
  /** Zatrzymaj dyktowanie (np. przy wysyłce). */
  stop: () => void;
}

/**
 * Dyktowanie do pola tekstowego. `onAppend` dostaje kolejne finalne fragmenty transkryptu — wołający
 * dokleja je do wartości pola. Bezpieczny no-op bez wsparcia przeglądarki.
 */
export function useDictation(onAppend: (text: string) => void, lang = "pl-PL"): Dictation {
  const [supported] = useState<boolean>(() => !!getRecognitionCtor());
  const [recording, setRecording] = useState(false);
  const recRef = useRef<ISpeechRecognition | null>(null);
  const appendRef = useRef(onAppend);
  appendRef.current = onAppend;

  const stop = useCallback(() => {
    const r = recRef.current;
    recRef.current = null;
    setRecording(false);
    try { r?.stop(); } catch { /* ignore */ }
  }, []);

  // Nigdy nie zostawiaj otwartego mikrofonu po odmontowaniu.
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* ignore */ } recRef.current = null; }, []);

  const toggle = useCallback(() => {
    if (recRef.current) { stop(); return; }
    const SR = getRecognitionCtor();
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      const t = finalText.trim();
      if (t) appendRef.current(t);
    };
    rec.onerror = () => { /* np. brak zgody / no-speech — nie hałasuj */ };
    rec.onend = () => { recRef.current = null; setRecording(false); };
    recRef.current = rec;
    try { rec.start(); setRecording(true); }
    catch { recRef.current = null; setRecording(false); }
  }, [lang, stop]);

  return { supported, recording, toggle, stop };
}
