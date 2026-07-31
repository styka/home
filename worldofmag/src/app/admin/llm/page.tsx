export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getLlmProviders, getAssignments, getAiCostBreakdown, getCostAlertThreshold, getUsdPlnRate, getSpeechConfig, getModelPrices, getFollowupsEnabled, getCostBadgeEnabled } from "@/actions/llmConfig";
import { CONFIG_LEVELS, type ConfigLevel } from "@/lib/llm/operationTypes";
import { LlmConfigPanel } from "@/components/admin/LlmConfigPanel";
import { ChevronLeft, Cpu } from "lucide-react";
import Link from "next/link";

export default async function AdminLlmPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  // 034: pobieramy komplet trzech poziomów naraz — przełącznik w panelu jest wtedy natychmiastowy
  // i nie potrzebuje dociągania po stronie klienta.
  const [providers, levelSets, cost, costThreshold, usdPlnRate, speech, prices, followupsEnabled, costBadgeEnabled] = await Promise.all([
    getLlmProviders(),
    Promise.all(CONFIG_LEVELS.map((lvl) => getAssignments(lvl))),
    getAiCostBreakdown(30),
    getCostAlertThreshold(),
    getUsdPlnRate(),
    getSpeechConfig(),
    getModelPrices(),
    getFollowupsEnabled(),
    getCostBadgeEnabled(),
  ]);
  const assignmentsByLevel = Object.fromEntries(
    CONFIG_LEVELS.map((lvl, i) => [lvl, levelSets[i]])
  ) as Record<ConfigLevel, typeof levelSets[number]>;

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/admin/config"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ChevronLeft size={14} />
          Konfiguracja
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Cpu size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Modele LLM
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, maxWidth: 620 }}>
          Dodaj dostawców (każdy z własnym tokenem) i przypisz model do każdego typu operacji.
          Typy odpowiadają charakterowi zadania, nie modułowi. Każdy z trzech poziomów pracy
          asystenta konfigurujesz osobno — pola zostawione puste dziedziczą z poziomu standardowego.
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
        />
      </div>
    </div>
  );
}
