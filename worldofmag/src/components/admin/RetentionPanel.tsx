"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setRetentionDays, type StanRetencjiDTO } from "@/actions/config";

/**
 * 083 (zadanie 30) — RETENCJA DANYCH w `/admin/config`.
 *
 * Lista pól pochodzi z polityk (`getRetentionSettings`), a nie z ręcznego spisu w tym pliku — nowa
 * polityka sama dokłada wiersz. Ręczny spis rozjechałby się przy pierwszej zmianie i objawił tabelą,
 * która rośnie mimo „skonfigurowanej” retencji.
 *
 * Panel pokazuje też ostatni przebieg. Bez tego jedynym śladem po kasowaniu danych byłby brak
 * danych — a wtedy „czy retencja w ogóle chodzi” to pytanie bez odpowiedzi.
 */
export function RetentionPanel({ stan }: { stan: StanRetencjiDTO }) {
  const t = useTranslations("components.admin.RetentionPanel");
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        Retencja danych
      </h2>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 0, marginBottom: 14 }}>
          {t("daneStarszeNizPodana")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stan.polityki.map((p) => (
            <WierszPolityki key={p.klucz} polityka={p} />
          ))}
        </div>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {stan.ostatniPrzebieg
              ? `Ostatni przebieg: ${new Date(stan.ostatniPrzebieg).toLocaleString("pl-PL")}`
              : "Retencja nie wykonała się jeszcze ani razu."}
          </div>
          {stan.ostatniWynik.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {stan.ostatniWynik.map((w) => (
                <li key={w.klucz}>
                  {w.etykieta}: {w.blad ? <span style={{ color: "var(--accent-red)" }}>błąd — {w.blad}</span> : `${w.usunieto} usuniętych (${w.dni} dni)`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function WierszPolityki({ polityka }: { polityka: StanRetencjiDTO["polityki"][number] }) {
  const [dni, setDni] = useState(String(polityka.dni));
  const [isPending, startTransition] = useTransition();
  const [stanZapisu, setStanZapisu] = useState<"" | "ok" | string>("");

  function zapisz() {
    setStanZapisu("");
    startTransition(async () => {
      try {
        await setRetentionDays(polityka.klucz, Number(dni));
        setStanZapisu("ok");
      } catch (e) {
        setStanZapisu(e instanceof Error ? e.message : "Nie udało się zapisać.");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 13, color: "var(--text-primary)" }}>
          {polityka.etykieta}
        </span>
        <input
          type="number"
          min={polityka.minimumDni || 1}
          value={dni}
          onChange={(e) => { setDni(e.target.value); setStanZapisu(""); }}
          style={{
            width: 90, padding: "6px 8px", fontSize: 13, borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>dni</span>
        <button
          type="button"
          onClick={zapisz}
          disabled={isPending}
          className="py-3"
          style={{
            padding: "6px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
            border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
          }}
        >
          Zapisz
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 3 }}>
        {polityka.uzasadnienie} Domyślnie {polityka.domyslneDni} dni
        {polityka.minimumDni > 0 && `, minimum ${polityka.minimumDni}`}.
      </div>
      {stanZapisu === "ok" && <div style={{ fontSize: 11.5, color: "var(--accent-green)", marginTop: 3 }}>Zapisano</div>}
      {stanZapisu && stanZapisu !== "ok" && <div style={{ fontSize: 11.5, color: "var(--accent-red)", marginTop: 3 }}>{stanZapisu}</div>}
    </div>
  );
}
