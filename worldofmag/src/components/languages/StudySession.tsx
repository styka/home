"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, RotateCcw, PartyPopper } from "lucide-react";
import { pageContainerStyle } from "@/components/ui/home";
import { submitReview } from "@/actions/languageDecks";
import { REVIEW_OPTIONS, type ReviewGrade } from "@/lib/srs";
import type { LanguageDeck, Vocabulary } from "@/types";

export function StudySession({ deck, cards }: { deck: LanguageDeck; cards: Vocabulary[] }) {
  const [queue, setQueue] = useState<Vocabulary[]>(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);

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
        setReviewed((r) => r + 1);
      } finally {
        setBusy(false);
      }
    },
    [current, busy]
  );

  // Klawiatura: spacja odsłania, 1–4 oceniają.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (revealed) {
        const opt = REVIEW_OPTIONS.find((o) => o.key === e.key);
        if (opt) {
          e.preventDefault();
          grade(opt.grade);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, done, grade]);

  return (
    <div style={pageContainerStyle}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href={`/languages/${deck.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
            <ChevronLeft size={14} /> {deck.name}
          </Link>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {done ? `${reviewed} powtórzonych` : `${index + 1} / ${queue.length}`}
          </span>
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
            <Link href={`/languages/${deck.id}`} className="px-4 py-2 rounded text-sm font-medium" style={{ background: "var(--accent-purple)", color: "#fff", textDecoration: "none", marginTop: 8 }}>
              Wróć do talii
            </Link>
          </div>
        ) : (
          <>
            {/* Karta */}
            <div
              onClick={() => !revealed && setRevealed(true)}
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
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)" }}>{current.term}</div>
              {current.partOfSpeech && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{current.partOfSpeech}</div>}
              {revealed ? (
                <>
                  <div style={{ width: 40, borderTop: "1px solid var(--border)" }} />
                  <div style={{ fontSize: 20, color: "var(--accent-purple)" }}>{current.translation}</div>
                  {current.example && <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>{current.example}</div>}
                </>
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
