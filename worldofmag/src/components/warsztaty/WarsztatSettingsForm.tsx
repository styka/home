"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Home, Building2, Check } from "lucide-react";
import { setWarsztatMode, type WarsztatMode } from "@/actions/warsztat";

export function WarsztatSettingsForm({ mode }: { mode: WarsztatMode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function chooseMode(next: WarsztatMode) {
    if (next === mode) return;
    startTransition(async () => {
      await setWarsztatMode(next);
      router.refresh();
    });
  }

  const cards: Array<{ id: WarsztatMode; title: string; desc: string; icon: typeof Home; color: string }> = [
    {
      id: "home",
      title: "Dom",
      desc: "Hobbysta / majsterkowicz. Warsztaty i pracownie, ewidencja wyposażenia, podpowiedzi sprzętu wg profilu i przypomnienia o przeglądach.",
      icon: Home,
      color: "var(--accent-green)",
    },
    {
      id: "pro",
      title: "Profesjonalny",
      desc: "Firma, kolektyw, zespół. Dodatkowo: warsztaty współdzielone z zespołem, przypisanie narzędzi (kto ma / stanowisko), agenda przeglądów + materiałów i dziennik projektów/zleceń.",
      icon: Building2,
      color: "var(--accent-purple)",
    },
  ];

  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl mx-auto flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Tryb warsztatu
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map((c) => {
            const active = mode === c.id;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => chooseMode(c.id)}
                disabled={pending}
                className="text-left rounded-lg border p-4 flex flex-col gap-2 disabled:opacity-60 transition-colors"
                style={{
                  borderColor: active ? c.color : "var(--border)",
                  backgroundColor: active ? "var(--bg-elevated)" : "var(--bg-surface)",
                }}
              >
                <div className="flex items-center justify-between">
                  <Icon size={20} style={{ color: c.color }} />
                  {active ? <Check size={16} style={{ color: c.color }} /> : null}
                </div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {c.title}
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {c.desc}
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Tryb Pro odblokowuje zakładkę „Przeglądy", przypisywanie narzędzi do osób/stanowisk i dziennik projektów.
        </p>
      </section>
    </div>
  );
}
