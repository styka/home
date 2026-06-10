"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, RotateCcw, PartyPopper, Check, X, Pencil, Layers } from "lucide-react";
import { pageContainerStyle } from "@/components/ui/home";
import { submitReview } from "@/actions/languageDecks";
import { REVIEW_OPTIONS, type ReviewGrade } from "@/lib/srs";
import { SpeakButton } from "./SpeakButton";
import type { LanguageDeck, Vocabulary } from "@/types";

// L2: normalizacja odpowiedzi do porównania (małe litery, bez znaków diakr./interpunkcji).
function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?()/\\[\]{}"'\u201c\u201d\u201e\u00ab\u00bb\-\u2013\u2014_\u2026]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Czy wpisana odpowiedź pasuje do tłumaczenia (akceptuje warianty po "," lub "/"). */
function answerMatches(input: string, translation: string): boolean {
  const given = normalizeAnswer(input);
  if (!given) return false;
  return translation
    .split(/[,/;]/)
    .map((v) => normalizeAnswer(v))
    .filter(Boolean)
    .some((v) => v === given);
}

export function StudySession({ deck, cards }: { deck: LanguageDeck; cards: Vocabulary[] }) {
  const [queue, setQueue] = useState<Vocabulary[]>(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"flip" | "write">("flip");
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = queue[index];
  const done = index >= queue.length;

  const grade = useCallback(
    async (g: ReviewGrade) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        await submitReview(current.id, g);
        setIndex((i) => i + 1);
        setRevealed(false);
        setAnswer("");
        setCorrect(null);
        setReviewed((r) => r + 1);
      } finally {
        setBusy(false);
      }
    },
    [current, busy]
  );

  // W trybie pisania sprawdza odpowiedź i odsłania kartę.
  const checkAnswer = useCallback(() => {
    if (!current || revealed) return;
    setCorrect(answerMatches(answer, current.translation));
    setRevealed(true);
  }, [current, revealed, answer]);

  // Po przejściu do nowej karty w trybie pisania — fokus na polu.
  useEffect(() => {
    if (mode === "write" && !revealed && !done) inputRef.current?.focus();
  }, [index, mode, revealed, done]);

  // Klawiatura: spacja odsłania (tryb fiszek), 1–4 oceniają. W trybie pisania
  // przed odsłonięciem nie przechwytujemy klawiszy — pisanie obsługuje pole tekstowe.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (!revealed) {
        if (mode === "flip" && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      const opt = REVIEW_OPTIONS.find((o) => o.key === e.key);
      if (opt) {
        e.preventDefault();
        grade(opt.grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, grade, mode]);

  return (
    <div style={pageContainerStyle}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href={`/languages/${deck.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
            <ChevronLeft size={14} /> {deck.name}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!done && (
              <div style={{ display: "flex", gap: 2, borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                <button onClick={() => { setMode("flip"); setRevealed(false); setCorrect(null); setAnswer(""); }} title="Fiszki"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11, border: "none", cursor: "pointer", background: mode === "flip" ? "var(--bg-hover)" : "transparent", color: mode === "flip" ? "var(--accent-purple)" : "var(--text-muted)" }}>
                  <Layers size={12} /> Fiszki
                </button>
                <button onClick={() => { setMode("write"); setRevealed(false); setCorrect(null); setAnswer(""); }} title="Pisanie"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11, border: "none", cursor: "pointer", background: mode === "write" ? "var(--bg-hover)" : "transparent", color: mode === "write" ? "var(--accent-purple)" : "var(--text-muted)" }}>
                  <Pencil size={12} /> Pisanie
                </button>
              </div>
            )}
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {done ? `${reviewed} powtórzonych` : `${index + 1} / ${queue.length}`}
            </span>
          </div>
        </div>

        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 16px", textAlign: "center" }}>
            <PartyPopper size={40} style={{ color: "var(--accent-green)" }} />
            <p style={{ fontSize: 16, color: "var(--text-primary)", margin: 0, fontWeight: 600 }}>
              {reviewed > 0 ? "Sesja ukończona!" : "Nic do powtórki"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              {reviewed > 0 ? `Powtórzono ${reviewed} słówek. Wróć później po kolejne.` : "Wszystkie słówka są na bieżąco. Dodaj nowe lub wróć później."}
            </p>
            <Link href={`/languages/${deck.id}`} className="px-4 py-2 rounded text-sm font-medium" style={{ background: "var(--accent-purple)", color: "var(--on-accent)", textDecoration: "none", marginTop: 8 }}>
              Wróć do talii
            </Link>
          </div>
        ) : (
          <>
            {/* Karta */}
            <div
              onClick={() => { if (!revealed && mode === "flip") setRevealed(true); }}
              style={{
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                padding: 24,
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                cursor: revealed ? "default" : "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)" }}>{current.term}</span>
                <SpeakButton text={current.term} lang={deck.targetLang} size={18} />
              </div>
              {current.partOfSpeech && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{current.partOfSpeech}</div>}
              {revealed ? (
                <>
                  {mode === "write" && correct !== null && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: correct ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {correct ? <><Check size={15} /> Dobrze!</> : <><X size={15} /> {answer.trim() ? `„${answer.trim()}" — niepoprawnie` : "Brak odpowiedzi"}</>}
                    </div>
                  )}
                  <div style={{ width: 40, borderTop: "1px solid var(--border)" }} />
                  <div style={{ fontSize: 20, color: "var(--accent-purple)" }}>{current.translation}</div>
                  {current.example && <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>{current.example}</div>}
                </>
              ) : mode === "write" ? (
                <form onSubmit={(e) => { e.preventDefault(); checkAnswer(); }} style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
                  <input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={`Wpisz tłumaczenie (${deck.nativeLang})`}
                    autoComplete="off" autoCorrect="off" spellCheck={false}
                    style={{ width: "100%", textAlign: "center", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 16 }}
                  />
                  <button type="submit" className="px-4 py-2 rounded text-sm font-medium" style={{ background: "var(--accent-purple)", color: "var(--on-accent)", border: "none" }}>
                    Sprawdź
                  </button>
                </form>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <RotateCcw size={12} /> Kliknij lub spacja, aby odsłonić
                </div>
              )}
            </div>

            {/* Oceny */}
            {revealed && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {REVIEW_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => grade(o.grade)}
                    disabled={busy}
                    className="flex flex-col items-center gap-1 py-2 rounded text-sm font-medium disabled:opacity-40"
                    style={{ background: "var(--bg-surface)", border: `1px solid ${o.color}`, color: o.color }}
                  >
                    {o.label}
                    <span style={{ fontSize: 10, opacity: 0.7, color: "var(--text-muted)" }}>{o.key}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
