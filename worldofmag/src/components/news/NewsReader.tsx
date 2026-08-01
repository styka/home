"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { splitSentences } from "@/lib/speech/sentences";
import { primeSpeech, speak, stopSpeaking, speechAvailable } from "@/lib/tts";

/**
 * 039: lektor wiadomości — czyta zdanie po zdaniu i podświetla to, które właśnie leci.
 *
 * Dlaczego łańcuch po `onEnd`, a nie znaczniki czasu od dostawcy: `speak()` woła `onEnd` zarówno
 * dla głosu serwerowego, jak i dla syntezy przeglądarki, więc ta sama pętla działa w obu ścieżkach
 * i nie wymaga niczego od dostawcy TTS (decyzja właściciela). Ceną jest ziarnistość zdania —
 * i dokładnie o zdanie chodzi w podświetleniu.
 */
export function NewsReader({ title, text }: { title: string; text: string }) {
  const sentences = useMemo(() => {
    // Tytuł czytamy jako pierwsze zdanie — bez niego odsłuch zaczyna się w połowie myśli.
    const body = splitSentences(text);
    return title.trim() ? [title.trim(), ...body] : body;
  }, [title, text]);

  const [current, setCurrent] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [supported, setSupported] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  // Indeks trzymany też w ref, bo `onEnd` domyka wartość z chwili wywołania `speak`.
  const indexRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    setSupported(speechAvailable());
  }, []);

  // Wyjście ze strony/odmontowanie nie może zostawić mówiącego lektora.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopSpeaking();
    };
  }, []);

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
      setCurrent(index);
      setPaused(false);
      speak(sentences[index], "pl", {
        onEnd: () => {
          // Zatrzymanie/przeskok w międzyczasie unieważnia ten łańcuch.
          if (!activeRef.current || indexRef.current !== index) return;
          playFrom(index + 1);
        },
      });
    },
    [sentences]
  );

  // Przewijamy do bieżącego zdania — przy dłuższym tekście podświetlenie inaczej ucieka z ekranu.
  useEffect(() => {
    if (current == null) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-sentence="${current}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

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
    activeRef.current = false;
    stopSpeaking();
    setCurrent(null);
    setPaused(false);
    indexRef.current = 0;
  }

  function step(delta: number) {
    const next = Math.min(Math.max((current ?? 0) + delta, 0), sentences.length - 1);
    primeSpeech();
    playFrom(next);
  }

  if (sentences.length === 0) return null;

  if (!supported) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        Ta przeglądarka nie obsługuje odczytu na głos.
      </p>
    );
  }

  const playing = current != null && !paused;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
      <div ref={listRef} className="max-h-72 overflow-y-auto p-3 text-sm leading-relaxed">
        {sentences.map((s, i) => (
          <span
            key={i}
            data-sentence={i}
            role="button"
            tabIndex={0}
            onClick={() => step(i - (current ?? 0))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                step(i - (current ?? 0));
              }
            }}
            className={cn(
              "cursor-pointer rounded px-0.5 transition-colors",
              i === current
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            )}
            style={
              i === current
                ? { boxShadow: "inset 2px 0 0 var(--accent-purple)", paddingLeft: 6 }
                : undefined
            }
          >
            {s}{" "}
          </span>
        ))}
      </div>

      {/* Pasek sterowania przyklejony do dołu karty — na telefonie musi być w zasięgu kciuka i nie
          może chować się pod paskiem systemowym (C-31). */}
      <div
        className="sticky bottom-0 flex items-center gap-1 border-t border-[var(--border)] bg-[var(--bg-surface)] px-2 py-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <ReaderButton onClick={() => step(-1)} label="Poprzednie zdanie" disabled={current == null}>
          <SkipBack size={16} />
        </ReaderButton>
        {current == null ? (
          <ReaderButton onClick={start} label="Czytaj na głos" primary>
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
          label="Następne zdanie"
          disabled={current == null || current >= sentences.length - 1}
        >
          <SkipForward size={16} />
        </ReaderButton>
        <ReaderButton onClick={stop} label="Zatrzymaj" disabled={current == null}>
          <Square size={16} />
        </ReaderButton>
        <span className="ml-auto pr-1 text-[11px] text-[var(--text-muted)]">
          {current == null ? `${sentences.length} zdań` : `${current + 1}/${sentences.length}`}
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
