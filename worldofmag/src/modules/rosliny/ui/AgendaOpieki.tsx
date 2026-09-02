"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck, Check, SkipForward, Clock, BellOff } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { recordCare, updateCareTask, type PozycjaAgendy } from "../actions/opieka";
import { drobny, kolorKubelka, przycisk, sekcja } from "./style";

/**
 * 113 — agenda opieki ze wszystkich przestrzeni (AC-9, AC-10).
 *
 * **Każda pozycja niesie uzasadnienie terminu i to jest cała różnica wobec zwykłej listy zadań.**
 * Aplikacja, która każe, jest posłuszna raz; aplikacja, która tłumaczy, uczy — a użytkownik, który
 * rozumie powód, przestaje pytać asystenta o to samo (realna oszczędność, nie tylko lepszy UX).
 *
 * **Cztery przyciski, nie jeden.** „Pomiń" i „Odłóż" istnieją, bo harmonogram, którego nie da się
 * odłożyć, po tygodniu składa się wyłącznie z zaległości i przestaje być czytany. Różnica między
 * nimi jest realna: pominięcie przesuwa CYKL (liczymy od dziś), odłożenie przesuwa TERMIN o kilka
 * dni i cykl zostawia w spokoju. Czwarty — „Nie przypominaj" — jest jedynym WYJŚCIEM z cyklu:
 * bez niego zadanie założone raz wracało na agendę na zawsze.
 */
export function AgendaOpieki({ pozycje: poczatkowe }: { pozycje: PozycjaAgendy[] }) {
  const t = useTranslations("modules.rosliny.AgendaOpieki");
  const confirmDialog = useConfirm();
  const [pozycje, setPozycje] = useState(poczatkowe);
  const [pending, startTransition] = useTransition();

  function wykonaj(p: PozycjaAgendy, outcome: "DONE" | "SKIPPED" | "POSTPONED") {
    startTransition(async () => {
      await recordCare({ taskId: p.id, outcome });
      // Pozycja znika z listy „na teraz" niezależnie od wyniku — jej następny termin właśnie się
      // przesunął. Zostawienie jej na ekranie sugerowałoby, że kliknięcie nic nie zrobiło.
      setPozycje((lista) => lista.filter((x) => x.id !== p.id));
    });
  }

  /**
   * Wyłączenie zadania — jedyne wyjście z cyklu, którego nie da się już wznowić „samo".
   *
   * Bez tego zadanie założone raz (np. podlewanie rośliny, która poszła do znajomych) wracało na
   * agendę co kilka dni na zawsze, a jedyną obroną było odkładanie go w nieskończoność. To jest
   * dokładnie ten mechanizm, przez który lista zaległości przestaje być czytana.
   *
   * Pytamy o potwierdzenie, ale **nie jest to akcja niszcząca** (C-34): historia zabiegów zostaje,
   * znika tylko planowanie na przyszłość.
   */
  function wylacz(p: PozycjaAgendy) {
    startTransition(async () => {
      if (!(await confirmDialog({ title: t("wylaczPytanie", { tytul: p.title }) }))) return;
      await updateCareTask(p.id, { active: false });
      setPozycje((lista) => lista.filter((x) => x.id !== p.id));
    });
  }

  const KUBELKI = ["OVERDUE", "TODAY", "SOON"] as const;
  const grupy = KUBELKI.map((klucz) => ({ klucz, pozycje: pozycje.filter((p) => p.bucket === klucz) })).filter(
    (g) => g.pozycje.length > 0,
  );

  return (
    <ModuleView
      icon={<CalendarCheck size={18} />}
      iconColor="var(--accent-green)"
      title={t("tytul")}
      breadcrumb={
        <Link href="/rosliny" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {t("wroc")}
        </Link>
      }
      state={pozycje.length === 0 ? "empty" : "ready"}
      empty={{ title: t("pustoTytul"), description: t("pustoOpis"), icon: <CalendarCheck size={22} /> }}
    >
      {grupy.map((g) => (
        <section key={g.klucz} style={sekcja}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", color: kolorKubelka(g.klucz) }}>
            {t(`grupa.${g.klucz}`)} ({g.pozycje.length})
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {g.pozycje.map((p) => (
              <li key={p.id} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  <Link
                    href={p.plantId ? `/rosliny/${p.spaceId}/roslina/${p.plantId}` : `/rosliny/${p.spaceId}`}
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
                  >
                    {p.title}
                  </Link>
                  {p.plantName && <span style={drobny}>{p.plantName}</span>}
                  <span style={{ ...drobny, marginLeft: "auto" }}>{p.spaceName}</span>
                </div>
                {p.reason && <p style={{ ...drobny, margin: 0 }}>{p.reason}</p>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" style={przycisk} disabled={pending} onClick={() => wykonaj(p, "DONE")}>
                    <Check size={13} aria-hidden />
                    {t("zrobione")}
                  </button>
                  <button type="button" style={przycisk} disabled={pending} onClick={() => wykonaj(p, "POSTPONED")}>
                    <Clock size={13} aria-hidden />
                    {t("odloz")}
                  </button>
                  <button type="button" style={przycisk} disabled={pending} onClick={() => wykonaj(p, "SKIPPED")}>
                    <SkipForward size={13} aria-hidden />
                    {t("pomin")}
                  </button>
                  <button type="button" style={przycisk} disabled={pending} onClick={() => wylacz(p)}>
                    <BellOff size={13} aria-hidden />
                    {t("wylacz")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ModuleView>
  );
}
