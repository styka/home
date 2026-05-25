"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Pencil, Trash2, PawPrint } from "lucide-react";
import { pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { speciesEmoji, speciesLabel, ageFromBirth, STATUS_LABELS, SEX_LABELS } from "@/lib/petSpecies";
import { resolveFeatures, PET_FEATURE_PHASE, type PetFeatureKey } from "@/lib/petPresets";
import { deletePet } from "@/actions/pets";
import { PetForm } from "./PetForm";
import {
  ProfileSection, MeasurementsSection, TreatmentsSection, VetSection, HealthSection,
  FeedingSection, RoutinesSection, FinanceSection, DocumentsSection, SharingSection,
  FeatureSettingsSection, ComingSoonSection,
} from "./PetSections";
import { useToast } from "@/components/ui/Toast";
import type { PetWithRelations, PetSex } from "@/types";

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

export function PetDetailPage({ pet, teams }: { pet: PetWithRelations; teams: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabKey>("profile");
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

  function handleDelete() {
    if (!confirm(`Usunąć zwierzę „${pet.name}" wraz ze wszystkimi danymi?`)) return;
    deletePet(pet.id)
      .then(() => { showToast("Usunięto zwierzę", "success"); router.push("/pets"); })
      .catch((e) => showToast(e instanceof Error ? e.message : "Błąd", "error"));
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
      case "sharing": return <SharingSection pet={pet} teams={teams} />;
      case "settings": return <FeatureSettingsSection pet={pet} />;
      default: {
        const phase = PET_FEATURE_PHASE[tab as PetFeatureKey];
        return <ComingSoonSection feature={tab as PetFeatureKey} phase={phase} />;
      }
    }
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <Link href="/pets" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={15} /> Zwierzęta
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, overflow: "hidden" }}>
            {pet.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photoUrl} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <PawPrint size={26} style={{ color: "var(--accent-orange)" }} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{pet.name}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>
              {speciesEmoji(pet.species)} {speciesLabel(pet.species)}
              {pet.breed ? ` · ${pet.breed}` : ""}
              {pet.sex && pet.sex !== "unknown" ? ` · ${SEX_LABELS[pet.sex as PetSex]}` : ""}
              {age ? ` · ${age}` : ""}
              {pet.status !== "ACTIVE" ? ` · ${STATUS_LABELS[pet.status as keyof typeof STATUS_LABELS]}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} title="Edytuj" style={iconBtn}><Pencil size={15} /></button>
            <button onClick={handleDelete} title="Usuń" style={{ ...iconBtn, color: "var(--accent-red)" }}><Trash2 size={15} /></button>
          </div>
        </div>

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
      </div>

      {editing && <PetForm pet={pet} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
