"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2, Play, Sparkles, Loader2, Pencil, Check, X } from "lucide-react";
import { pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import { addWord, bulkAddWords, deleteWord, updateWord, deleteDeck } from "@/actions/languageDecks";
import { llm } from "@/lib/llm-client";
import type { LanguageDeck, Vocabulary } from "@/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
};

function isDue(card: Vocabulary): boolean {
  return new Date(card.dueAt).getTime() <= Date.now();
}

export function DeckPage({ deck }: { deck: LanguageDeck & { cards: Vocabulary[] } }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [genText, setGenText] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editTranslation, setEditTranslation] = useState("");

  const dueCount = deck.cards.filter(isDue).length;

  async function add() {
    if (!term.trim() || !translation.trim()) return;
    await addWord(deck.id, { term, translation });
    setTerm("");
    setTranslation("");
    router.refresh();
  }

  async function generate() {
    if (!genText.trim()) return;
    setGenBusy(true);
    try {
      const res = await llm.languages.extract({
        sourceText: genText,
        nativeLang: deck.nativeLang,
        targetLang: deck.targetLang,
        max: 25,
      });
      if (res.words?.length) {
        await bulkAddWords(deck.id, res.words);
        setGenText("");
        setShowGen(false);
        router.refresh();
      }
    } finally {
      setGenBusy(false);
    }
  }

  async function remove(id: string) {
    await deleteWord(id);
    router.refresh();
  }

  function startEdit(card: Vocabulary) {
    setEditId(card.id);
    setEditTerm(card.term);
    setEditTranslation(card.translation);
  }

  async function saveEdit() {
    if (!editId) return;
    await updateWord(editId, { term: editTerm, translation: editTranslation });
    setEditId(null);
    router.refresh();
  }

  async function removeDeck() {
    if (!confirm(`Usunąć talię „${deck.name}" wraz ze wszystkimi słówkami?`)) return;
    await deleteDeck(deck.id);
    router.push("/languages");
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/languages" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={14} /> Nauka języków
        </Link>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{deck.name}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
              {deck.nativeLang} → {deck.targetLang} · {deck.cards.length} słówek · {dueCount} do powtórki
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link
              href={`/languages/${deck.id}/study`}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium"
              style={{ background: dueCount > 0 ? "var(--accent-green)" : "var(--bg-hover)", color: dueCount > 0 ? "#fff" : "var(--text-secondary)", textDecoration: "none" }}
            >
              <Play size={15} /> Ucz się
            </Link>
            <button onClick={removeDeck} className="p-2 rounded" style={{ color: "var(--accent-red)", background: "var(--bg-hover)", border: "none" }} title="Usuń talię">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Dodawanie słówka */}
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} value={term} onChange={(e) => setTerm(e.target.value)} placeholder={`Słówko (${deck.targetLang})`} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <input style={inputStyle} value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder={`Tłumaczenie (${deck.nativeLang})`} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button onClick={add} disabled={!term.trim() || !translation.trim()} className="flex items-center px-3 rounded disabled:opacity-40" style={{ background: "var(--accent-blue)", color: "var(--on-accent)", border: "none" }}>
            <Plus size={16} />
          </button>
        </div>

        {/* Generowanie z tekstu */}
        {showGen ? (
          <div style={{ ...cardStyle, flexDirection: "column", alignItems: "stretch", gap: 10, cursor: "default" }}>
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
              value={genText}
              onChange={(e) => setGenText(e.target.value)}
              placeholder="Wklej tekst — AI wyciągnie z niego kolejne słówka…"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={generate} disabled={genBusy || !genText.trim()} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium disabled:opacity-40" style={{ background: "var(--accent-amber)", color: "var(--on-accent)", border: "none" }}>
                {genBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {genBusy ? "Generuję…" : "Wygeneruj słówka"}
              </button>
              <button onClick={() => setShowGen(false)} disabled={genBusy} className="px-3 py-2 rounded text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>Anuluj</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowGen(true)} className="flex items-center gap-2 px-3 py-2 rounded text-sm self-start" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none" }}>
            <Sparkles size={14} style={{ color: "var(--accent-amber)" }} /> Dodaj słówka z tekstu (AI)
          </button>
        )}

        {/* Lista słówek */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {deck.cards.map((card) => (
            <div key={card.id} style={{ ...cardStyle, cursor: "default", gap: 10 }}>
              {editId === card.id ? (
                <>
                  <input style={inputStyle} value={editTerm} onChange={(e) => setEditTerm(e.target.value)} />
                  <input style={inputStyle} value={editTranslation} onChange={(e) => setEditTranslation(e.target.value)} />
                  <button onClick={saveEdit} className="p-1 rounded" style={{ color: "var(--accent-green)", background: "none", border: "none" }}><Check size={15} /></button>
                  <button onClick={() => setEditId(null)} className="p-1 rounded" style={{ color: "var(--text-muted)", background: "none", border: "none" }}><X size={15} /></button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--text-primary)" }}>
                      {card.term}
                      <span style={{ color: "var(--text-muted)", margin: "0 8px" }}>—</span>
                      <span style={{ color: "var(--text-secondary)" }}>{card.translation}</span>
                    </div>
                    {card.example && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{card.example}</div>}
                  </div>
                  {isDue(card) && <span title="Do powtórki" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent-green)", flexShrink: 0 }} />}
                  <button onClick={() => startEdit(card)} className="p-1 rounded" style={{ color: "var(--text-muted)", background: "none", border: "none" }}><Pencil size={14} /></button>
                  <button onClick={() => remove(card.id)} className="p-1 rounded" style={{ color: "var(--accent-red)", background: "none", border: "none" }}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
          {deck.cards.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
              Brak słówek. Dodaj je ręcznie lub wygeneruj z tekstu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
