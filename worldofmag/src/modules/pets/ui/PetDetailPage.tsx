"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback } from "react";
import { useViewState } from "@/hooks/useViewState";
import { oneOf, type RawParams } from "@/platform/viewState/viewState";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Pencil, Trash2, PawPrint, Printer, Download } from "lucide-react";

import { speciesEmoji, speciesLabel, ageFromBirth, STATUS_LABELS, SEX_LABELS } from "../lib/petSpecies";
import { resolveFeatures, PET_FEATURE_PHASE, PET_FEATURE_KEYS, type PetFeatureKey } from "../lib/petPresets";
import { buildVetCardHtml, buildMeasurementsCsv } from "../lib/petExport";
import { deletePet } from "../actions/pets";
import { PetForm } from "./PetForm";
import {
  ProfileSection, MeasurementsSection, TreatmentsSection, VetSection, HealthSection,
  FeedingSection, RoutinesSection, FinanceSection, DocumentsSection, SharingSection,
  FeatureSettingsSection, ComingSoonSection,
} from "./PetSections";
import { HusbandrySection, AquariumSection } from "./PetHusbandry";
import { BreedingSection, GeneticsSection } from "./PetBreeding";
import { useToast } from "@/components/ui/Toast";
import { ModuleView } from "@/components/ui/view";
import type { PetWithRelations, PetSex } from "@/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type TabKey = "profile" | PetFeatureKey | "sharing" | "settings";

const FEATURE_TAB_LABEL: Record<PetFeatureKey, string> = {
  MEASUREMENTS: "Pomiary",
  HEALTH: "Zdrowie",
  TREATMENTS: "Leki",
  VET: "Weterynarz",
  FEEDING: "Karmienie",
  ROUTINES: "Rutyny",
  FINANCE: "Finanse",
  DOCUMENTS: "Dokumenty",
  HUSBANDRY: "Terrarium",
  AQUARIUM: "Akwarium",
  BREEDING: "Hodowla",
  GENETICS: "Genetyka",
};

const FEATURE_ORDER: PetFeatureKey[] = [
  "HEALTH", "TREATMENTS", "VET", "MEASUREMENTS", "FEEDING", "ROUTINES",
  "HUSBANDRY", "AQUARIUM", "BREEDING", "GENETICS", "FINANCE", "DOCUMENTS",
];

export function PetDetailPage({ pet, teams, viewParams = {} }: { pet: PetWithRelations; teams: Array<{ id: string; name: string }>; viewParams?: RawParams }) {
  const t = useTranslations("modules.pets.PetDetailPage");
  const confirmDialog = useConfirm();
  const router = useRouter();
  const { showToast } = useToast();
  // 043: zakładka profilu zwierzęcia w adresie (AC-8a). Lista dopuszczalnych wartości bierze się
  // z cech włączonych dla gatunku (`PET_FEATURE_KEYS`) — wartość spoza niej wraca do „profile".
  const viewSpec = useMemo(() => ({
    tab: oneOf(["profile", ...PET_FEATURE_KEYS, "sharing", "settings"] as const, "profile"),
  }), []);
  const [view, setView] = useViewState(viewSpec, viewParams);
  const tab = view.tab as TabKey;
  const setTab = useCallback((value: TabKey) => setView({ tab: value }), [setView]);
  const [editing, setEditing] = useState(false);

  const features = resolveFeatures(pet);
  const enabledFeatures = FEATURE_ORDER.filter((f) => features[f]);
  const age = ageFromBirth(pet.birthDate);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "profile", label: "Profil" },
    ...enabledFeatures.map((f) => ({ key: f as TabKey, label: FEATURE_TAB_LABEL[f] })),
    { key: "sharing", label: "Udostępnianie" },
    { key: "settings", label: "Widoczność" },
  ];

  async function handleDelete() {
    if (!(await confirmDialog(`Usunąć zwierzę „${pet.name}" wraz ze wszystkimi danymi?`))) return;
    deletePet(pet.id)
      .then(() => { showToast("Usunięto zwierzę", "success"); router.push("/pets"); })
      .catch((e) => showToast(e instanceof Error ? e.message : "Błąd", "error"));
  }

  // P3: druk karty dla weterynarza (→ PDF z przeglądarki).
  function printVetCard() {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) { showToast("Zezwól na wyskakujące okna, aby wydrukować", "error"); return; }
    w.document.write(buildVetCardHtml(pet));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  // P3: eksport pomiarów do CSV.
  function exportCsv() {
    if (pet.measurements.length === 0) { showToast("Brak pomiarów do eksportu", "info"); return; }
    const blob = new Blob(["﻿" + buildMeasurementsCsv(pet)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pet.name.replace(/[^a-z0-9ąęśźżćńółĄĘŚŹŻĆŃÓŁ]+/gi, "-").toLowerCase()}-pomiary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderTab() {
    switch (tab) {
      case "profile": return <ProfileSection pet={pet} />;
      case "MEASUREMENTS": return <MeasurementsSection pet={pet} />;
      case "TREATMENTS": return <TreatmentsSection pet={pet} />;
      case "VET": return <VetSection pet={pet} />;
      case "HEALTH": return <HealthSection pet={pet} />;
      case "FEEDING": return <FeedingSection pet={pet} />;
      case "ROUTINES": return <RoutinesSection pet={pet} />;
      case "FINANCE": return <FinanceSection pet={pet} />;
      case "DOCUMENTS": return <DocumentsSection pet={pet} />;
      case "HUSBANDRY": return <HusbandrySection pet={pet} />;
      case "AQUARIUM": return <AquariumSection pet={pet} />;
      case "BREEDING": return <BreedingSection pet={pet} />;
      case "GENETICS": return <GeneticsSection pet={pet} />;
      case "sharing": return <SharingSection pet={pet} teams={teams} />;
      case "settings": return <FeatureSettingsSection pet={pet} />;
      default: {
        const phase = PET_FEATURE_PHASE[tab as PetFeatureKey];
        return <ComingSoonSection feature={tab as PetFeatureKey} phase={phase} />;
      }
    }
  }

  return (
    <ModuleView
      width="narrow"
      state="ready"
      breadcrumb={
        <Link href="/pets" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={15} /> {t("zwierzeta")}
        </Link>
      }
      icon={<PawPrint size={22} />}
      iconColor="var(--accent-orange)"
      title={pet.name}
      subtitle={`${speciesEmoji(pet.species)} ${speciesLabel(pet.species)}${pet.breed ? ` · ${pet.breed}` : ""}${pet.sex && pet.sex !== "unknown" ? ` · ${SEX_LABELS[pet.sex as PetSex]}` : ""}`}
    >


        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: "1px solid var(--border)", paddingBottom: 2 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "6px 12px", borderRadius: "6px 6px 0 0", border: "none", background: "none",
                fontSize: 13, fontWeight: tab === t.key ? 600 : 400, whiteSpace: "nowrap", cursor: "pointer",
                color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
                borderBottom: tab === t.key ? "2px solid var(--accent-orange)" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {renderTab()}


      {editing && <PetForm pet={pet} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />}
    </ModuleView>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
