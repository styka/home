"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Plus, Sparkles, Loader2, ArrowRight, BookOpen, Flame } from "lucide-react";
import { StatTile, SectionHeading } from "@/components/ui/home";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle, cardHoverHandlers } from "@/components/ui/home";
import { createDeck, bulkAddWords } from "@/actions/languageDecks";
import { llm } from "@/lib/llm-client";
import type { LanguageDeck } from "@/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
};

export function LanguagesHomePage({ decks, streak }: { decks: LanguageDeck[]; streak?: { streak: number; reviewedToday: number } }) {
  const totalCards = decks.reduce((s, d) => s + (d._count?.cards ?? 0), 0);
  const totalDue = decks.reduce((s, d) => s + (d.dueCount ?? 0), 0);
  const totalLearned = decks.reduce((s, d) => s + (d.learnedCount ?? 0), 0);
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [nativeLang, setNativeLang] = useState("polski");
  const [targetLang, setTargetLang] = useState("angielski");
  const [sourceText, setSourceText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const deck = await createDeck({
        name,
        nativeLang,
        targetLang,
        sourceText: sourceText.trim() || undefined,
      });
      // Jeśli podano tekst — od razu wygeneruj słówka przez AI.
      if (sourceText.trim()) {
        const res = await llm.languages.extract({ sourceText, nativeLang, targetLang, max: 25 });
        if (res.words?.length) {
          await bulkAddWords(deck.id, res.words);
        }
      }
      router.push(`/languages/${deck.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się utworzyć talii");
      setBusy(false);
    }
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<GraduationCap size={22} />}
          iconColor="var(--accent-purple)"
          title="Nauka języków"
          subtitle="Twórz talie słówek i ucz się ich powtórkami rozłożonymi w czasie"
          action={
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium"
              style={{ background: "var(--accent-purple)", color: "var(--on-accent)", border: "none" }}
            >
              <Plus size={15} /> Nowa talia
            </button>
          }
        />

        {decks.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            <StatTile value={decks.length} label="Talie" color="var(--accent-purple)" />
            <StatTile value={totalCards} label="Słówek" color="var(--accent-blue)" icon={<BookOpen size={14} />} />
            <StatTile value={totalLearned} label="Przeczonych" color="var(--accent-green)" />
            {totalDue > 0 && <StatTile value={totalDue} label="Do nauki" color="var(--accent-amber)" icon={<Flame size={14} />} />}
            {streak && streak.streak > 0 && (
              <StatTile value={`${streak.streak} dni`} label={streak.reviewedToday > 0 ? `Seria · dziś ${streak.reviewedToday}` : "Seria nauki"} color="var(--accent-orange)" icon={<Flame size={14} />} />
            )}
          </div>
        )}

        {showForm && (
          <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: 12, cursor: "default" }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Nazwa talii</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Słownictwo do demo projektu" autoFocus />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Język znany</label>
                <input style={inputStyle} value={nativeLang} onChange={(e) => setNativeLang(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Język uczony</label>
                <input style={inputStyle} value={targetLang} onChange={(e) => setTargetLang(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={12} style={{ color: "var(--accent-amber)" }} />
                Tekst źródłowy (opcjonalnie) — AI wyciągnie z niego słówka
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: 96, resize: "vertical", fontFamily: "inherit" }}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Wklej kod, artykuł lub dowolny tekst w języku, którego się uczysz…"
              />
            </div>
            {error && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={submit}
                disabled={busy || !name.trim()}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--accent-blue)", color: "var(--on-accent)", border: "none" }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {busy ? (sourceText.trim() ? "Generuję słówka…" : "Tworzę…") : "Utwórz talię"}
              </button>
              <button onClick={() => setShowForm(false)} disabled={busy} className="px-3 py-2 rounded text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {decks.length === 0 && !showForm ? (
          <EmptyState
            icon={<GraduationCap size={32} />}
            message="Brak talii"
            hint="Utwórz pierwszą talię i wygeneruj słówka z dowolnego tekstu."
            cta={{ label: "Nowa talia", onClick: () => setShowForm(true), color: "var(--accent-purple)" }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decks.map((d) => (
              <Link key={d.id} href={`/languages/${d.id}`} style={cardStyle} {...cardHoverHandlers}>
                <GraduationCap size={18} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {d.nativeLang} → {d.targetLang} · {d._count?.cards ?? 0} słówek
                    {(d.learnedCount ?? 0) > 0 && ` · ${d.learnedCount} przeczonych`}
                  </div>
                  {(d._count?.cards ?? 0) > 0 && (
                    <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "var(--accent-green)", width: `${Math.round(((d.learnedCount ?? 0) / (d._count?.cards ?? 1)) * 100)}%`, transition: "width 0.3s" }} />
                    </div>
                  )}
                </div>
                {(d.dueCount ?? 0) > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--on-accent)",
                      background: "var(--accent-green)",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                    title="Słówka do powtórki"
                  >
                    {d.dueCount} do nauki
                  </span>
                )}
                <ArrowRight size={15} style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
