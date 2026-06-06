import Link from "next/link";
import { BookOpen, Mic, Wand2, ShoppingCart, CheckSquare, FileText, ArrowLeft } from "lucide-react";

const EXAMPLES = [
  {
    category: "Zakupy",
    icon: <ShoppingCart size={14} />,
    color: "var(--accent-blue)",
    items: [
      '"Dodaj 2 kg jabłek i mleko do zakupów"',
      '"Sachol z apteki, 3 sztuki"',
      '"Dodaj chleb, masło i jajka"',
      '"Usuń mleko z listy zakupów"',
    ],
  },
  {
    category: "Zadania",
    icon: <CheckSquare size={14} />,
    color: "var(--accent-green)",
    items: [
      '"Zadzwoń do dentysty w piątek, pilne"',
      '"Przypomnij mi o spotkaniu z klientem 20 maja"',
      '"Przesuń termin mycia auta o 2 tygodnie"',
      '"Oznacz zadanie z projektem X jako wykonane"',
    ],
  },
  {
    category: "Notatki",
    icon: <FileText size={14} />,
    color: "var(--accent-amber)",
    items: [
      '"Notatka: pomysł na weekend — wycieczka w góry"',
      '"Dopisz do notatki przepis: dodaj 200g cukru"',
      '"Utwórz notatkę z przepisem na bigos"',
    ],
  },
  {
    category: "Wiele akcji naraz",
    icon: null,
    color: "var(--accent-purple)",
    items: [
      '"Dodaj Sachol do zakupów i zadzwoń do lekarza jutro"',
      '"Kup mleko, chleb i przypomnij o urodzinach mamy 15 maja"',
      '"Dodaj zadanie spotkanie w środę i notatkę z agendą"',
    ],
  },
];

export default function GuidePage() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "var(--bg-base)",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Back link */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-muted)",
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={14} />
          Strona główna
        </Link>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <BookOpen size={20} style={{ color: "var(--accent-purple)" }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Jak korzystać ze strony głównej?
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Strona główna pozwala zarządzać wszystkimi modułami aplikacji za pomocą języka naturalnego —
            wpisując lub mówiąc polecenia.
          </p>
        </div>

        {/* Voice section */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
            Sterowanie głosem
          </h2>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {[
              {
                icon: <Mic size={16} />,
                title: "Dyktuj tekst",
                desc: "Kliknij przycisk 🎙 w polu tekstowym — mów, a tekst pojawi się automatycznie. Kliknij ponownie aby zatrzymać.",
                color: "var(--accent-red)",
              },
              {
                icon: <Wand2 size={16} />,
                title: "Modyfikuj głosem",
                desc: "Kliknij 🪄 — opisz zmianę głosem, np. \"popraw błędy ortograficzne\" lub \"zamień psa na kota\". LLM zastosuje modyfikację.",
                color: "var(--accent-amber)",
              },
            ].map((item, i, arr) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                <span style={{ color: item.color, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, marginBottom: 2 }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
            Przykłady poleceń
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {EXAMPLES.map((ex) => (
              <div
                key={ex.category}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${ex.color}`,
                  borderRadius: "0 12px 12px 0",
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  {ex.icon && <span style={{ color: ex.color }}>{ex.icon}</span>}
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: ex.color, margin: 0 }}>
                    {ex.category}
                  </p>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {ex.items.map((item) => (
                    <li key={item} style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      <code
                        style={{
                          background: "var(--bg-elevated)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          color: "var(--text-primary)",
                          fontFamily: "inherit",
                          fontSize: 13,
                        }}
                      >
                        {item}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
            Wskazówki
          </h2>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {[
              "Możesz wydać kilka poleceń naraz w jednym zdaniu.",
              "Przed wykonaniem zawsze możesz sprawdzić i zmienić wykryte akcje w oknie potwierdzenia.",
              "Użyj selektora kontekstu aby zawęzić zakres do konkretnego modułu.",
              "Skrót Ctrl+Enter wysyła wiadomość bez klikania przycisku.",
              "Po wykonaniu akcji możesz od razu wydać kolejne polecenie.",
            ].map((tip, i, arr) => (
              <div
                key={tip}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "11px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : undefined,
                }}
              >
                <span style={{ color: "var(--accent-purple)", flexShrink: 0, fontWeight: 700, fontSize: 13 }}>{i + 1}.</span>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{tip}</p>
              </div>
            ))}
          </div>
        </section>

        <div style={{ textAlign: "center", paddingBottom: 32 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 10,
              background: "var(--accent-blue)",
              color: "var(--on-accent)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Wróć i spróbuj
          </Link>
        </div>
      </div>
    </div>
  );
}
