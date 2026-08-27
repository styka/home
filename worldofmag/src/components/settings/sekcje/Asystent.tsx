import { getTranslations } from "next-intl/server";
import { auth } from "@/platform/auth/session";
import { getActivePlan } from "@/lib/plans";
import { getMyAiUsage } from "@/platform/ai/budzet";
import { AiUsageMeters } from "@/components/settings/AiUsageMeters";
import { UserFactsSection } from "@/components/settings/UserFactsSection";
import { Podsekcja } from "@/components/settings/sekcje/Podsekcja";
import { PustaSekcja } from "@/components/settings/sekcje/PustaSekcja";

/**
 * 109: sekcja „Asystent i AI" — dawne bloki „Twój plan" (z licznikami zużycia) i „Wiedza o Tobie".
 *
 * 082 postawiło liczniki tam, gdzie stoi plan, bo limit, którego nie widać, użytkownik poznaje
 * dopiero w chwili odmowy. Wiedza o użytkowniku należy do tej samej rozmowy: to, co asystent
 * o tobie zakłada, i to, ile cię kosztuje.
 */
export async function Asystent() {
  const tSekcje = await getTranslations("app.settings.sekcje");
  const tPage = await getTranslations("app.settings.page");
  const tSekcja = await getTranslations("app.settings.sekcja");
  const session = await auth();
  const plan = session?.user?.id ? await getActivePlan(session.user.id) : null;
  const zuzycieAi = session?.user?.id ? await getMyAiUsage(session.user.id) : null;

  return (
    <>
      <Podsekcja tytul={tPage("twojPlan")}>
        {plan ? (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{plan.name}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)" }}>{plan.key}</span>
            </div>
            {zuzycieAi && <AiUsageMeters zuzycie={zuzycieAi} />}
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>
              {tPage("zmianaPlanuBedzieDostepna")}
            </div>
          </div>
        ) : (
          <PustaSekcja tytul={tSekcja("brakDanychTytul")} opis={tSekcja("planBrakOpis")} />
        )}
      </Podsekcja>

      {/* 039: wiedza o użytkowniku to sekcja o tym, co system o nim wie — od 109 stoi obok planu,
          a nie nad prywatnością, bo obie rzeczy dotyczą asystenta. Prywatność ma własną sekcję. */}
      <Podsekcja tytul={tSekcje("wiedzaOTobie")}>
        <UserFactsSection />
      </Podsekcja>
    </>
  );
}
