export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getLlmProviders, getAssignments, getAiCostBreakdown, getCostAlertThreshold, getUsdPlnRate, getSpeechConfig, getModelPrices, getFollowupsEnabled, getCostBadgeEnabled, getAiBudgetState } from "@/actions/llmConfig";
import { getDefaultSectionModes } from "@/actions/aiSections";
import { CONFIG_LEVELS, type ConfigLevel } from "@/platform/llm/operationTypes";
import { LlmConfigPanel } from "@/components/admin/LlmConfigPanel";
import { Cpu } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PowrotDoPanelu } from "@/components/admin/PowrotDoPanelu";

export default async function AdminLlmPage() {
  const t = await getTranslations("app.admin.llm.page");
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  // 034: pobieramy komplet trzech poziomów naraz — przełącznik w panelu jest wtedy natychmiastowy
  // i nie potrzebuje dociągania po stronie klienta.
  const [providers, levelSets, cost, costThreshold, usdPlnRate, speech, prices, followupsEnabled, costBadgeEnabled, sectionModes, budzet] = await Promise.all([
    getLlmProviders(),
    Promise.all(CONFIG_LEVELS.map((lvl) => getAssignments(lvl))),
    getAiCostBreakdown(30),
    getCostAlertThreshold(),
    getUsdPlnRate(),
    getSpeechConfig(),
    getModelPrices(),
    getFollowupsEnabled(),
    getCostBadgeEnabled(),
    getDefaultSectionModes(),
    getAiBudgetState(),
  ]);
  const assignmentsByLevel = Object.fromEntries(
    CONFIG_LEVELS.map((lvl, i) => [lvl, levelSets[i]])
  ) as Record<ConfigLevel, typeof levelSets[number]>;

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* 110 (AC-12): powrót prowadzi do PANELU, nie do konfiguracji.
            Wcześniej wracało się do `/admin/config`, bo to była jedyna droga tutaj — `/admin/llm`
            nie miało odnośnika z panelu ani z żadnego innego miejsca. Po 110 panel wymienia
            konfigurację i modele obok siebie w tej samej grupie, więc `config` jest stąd dalej
            o jedno kliknięcie, a reguła powrotu jest taka sama na wszystkich stronach panelu. */}
        <PowrotDoPanelu odstep={20} />
        <div className="flex items-center gap-3 mb-2">
          <Cpu size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Modele LLM
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, maxWidth: 620 }}>
          {t("dodajDostawcowKazdyZ")}
        </p>

        <LlmConfigPanel
          providers={providers}
          assignmentsByLevel={assignmentsByLevel}
          cost={cost}
          costThreshold={costThreshold}
          usdPlnRate={usdPlnRate}
          speech={speech}
          prices={prices}
          followupsEnabled={followupsEnabled}
          costBadgeEnabled={costBadgeEnabled}
          sectionModes={sectionModes}
          budzet={budzet}
        />
      </div>
    </div>
  );
}
