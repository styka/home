"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Brain, Check, X } from "lucide-react";
import { getPendingHypothesis, confirmUserFact, rejectUserFact } from "@/actions/userFacts";
import type { UserFactDTO } from "@/lib/userFacts";

/**
 * 039: JEDNA hipoteza o użytkowniku, pokazywana przy okazji — nigdy jako przerywnik.
 *
 * Ryzyko, którego ten komponent pilnuje (spec §9): mechanizm, który dopytuje „czy to o Tobie?",
 * bardzo łatwo zamienia się w ankietę zastępującą pracę. Dlatego: jedna karta, na dole widoku, bez
 * modala, bez blokowania czegokolwiek, i znika po jednej odpowiedzi. Brak hipotezy = brak karty.
 */
export function UserFactHypothesisCard() {
  const t = useTranslations("ui.userFact");
  const [fact, setFact] = useState<UserFactDTO | null>(null);
  const [done, setDone] = useState(false);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    getPendingHypothesis()
      .then(setFact)
      .catch(() => setFact(null));
  }, []);

  if (!fact || done) return null;

  function answer(yes: boolean) {
    const id = fact!.id;
    // Karta znika od razu — potwierdzenie to uprzejmość wobec systemu, a nie zadanie, na którego
    // wynik użytkownik ma czekać.
    setDone(true);
    startBusy(async () => {
      try {
        await (yes ? confirmUserFact(id) : rejectUserFact(id));
      } catch {
        /* nieudane potwierdzenie hipotezy nie jest warte komunikatu błędu */
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
      <Brain size={15} className="shrink-0 text-[var(--accent-purple)]" />
      <p className="min-w-0 flex-1 text-xs text-[var(--text-secondary)]">
        <span className="text-[var(--text-muted)]">Zgadujemy: </span>
        {fact.text}
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={() => answer(true)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Check size={13} /> {t("confirm")}
        </button>
        <button
          onClick={() => answer(false)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <X size={13} /> {t("nieOMnie")}
        </button>
      </div>
    </div>
  );
}
