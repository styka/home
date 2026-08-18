import type { MojeZuzycieAI } from "@/platform/ai/budzet";

/**
 * 082 (zadanie 27) — „WYKORZYSTANO X Z Y" dla właściciela konta.
 *
 * Rozdz. 11.3 wymienia widoczność dla użytkownika jako jeden z czterech mechanizmów budżetu — obok
 * limitu miesięcznego, limitu globalnego i alarmu progowego. Powód jest praktyczny: limit, którego
 * nie widać, użytkownik poznaje dopiero w chwili odmowy, i wtedy wygląda ona na awarię.
 *
 * Komponent SERWEROWY i bez interakcji — to jest odczyt stanu, nie ustawienie. Kolor paska zmienia
 * się dopiero od 80 %, żeby zwykłe korzystanie nie wyglądało na ostrzeżenie.
 */
export function AiUsageMeters({ zuzycie }: { zuzycie: MojeZuzycieAI }) {
  const pozycje = [
    { etykieta: "Zapytania dziś", uzyte: zuzycie.dzien.requests, limit: zuzycie.dzien.limitRequests, jednostka: "" },
    { etykieta: "Tokeny dziś", uzyte: zuzycie.dzien.tokens, limit: zuzycie.dzien.limitTokens, jednostka: "" },
    { etykieta: "Tokeny w tym miesiącu", uzyte: zuzycie.miesiac.tokens, limit: zuzycie.miesiac.limitTokens, jednostka: "" },
  ];

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {pozycje.map((p) => {
        const udzial = p.limit > 0 ? Math.min(1, p.uzyte / p.limit) : 0;
        const kolor = udzial >= 1 ? "var(--accent-red)" : udzial >= 0.8 ? "var(--accent-amber)" : "var(--accent-green)";
        return (
          <div key={p.etykieta}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
              <span>{p.etykieta}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {p.uzyte.toLocaleString("pl-PL")} z {p.limit.toLocaleString("pl-PL")}
                {p.jednostka}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(udzial * 100)}%`, background: kolor }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
