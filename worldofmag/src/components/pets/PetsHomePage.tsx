"use client";

import { useState } from "react";
import { PawPrint, Plus, AlertCircle, Clock, CalendarDays, Sparkles } from "lucide-react";
import { PageHeader, StatTile, SectionHeading, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { PetCard } from "./PetCard";
import { PetForm } from "./PetForm";
import { CareAgenda } from "./CareAgenda";
import { WelfareSuggestions } from "./WelfareSuggestions";
import type { Pet, CareAgendaItem, WelfareSuggestion } from "@/types";

interface Props {
  pets: Pet[];
  agenda: CareAgendaItem[];
  suggestions: WelfareSuggestion[];
  teams: Array<{ id: string; name: string }>;
}

export function PetsHomePage({ pets, agenda, suggestions, teams }: Props) {
  const [showForm, setShowForm] = useState(false);

  const overdue = agenda.filter((a) => a.bucket === "OVERDUE").length;
  const today = agenda.filter((a) => a.bucket === "TODAY").length;
  const upcoming = agenda.filter((a) => a.bucket === "UPCOMING").length;
  const activePets = pets.filter((p) => p.status === "ACTIVE");

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<PawPrint size={22} />}
          iconColor="var(--accent-orange)"
          title="Zwierzęta"
          subtitle="Dobrostan, zdrowie i opieka — w jednym miejscu"
          action={
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: "var(--accent-orange)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus size={15} /> Dodaj
            </button>
          }
        />

        {pets.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            <StatTile value={activePets.length} label="Zwierzęta" color="var(--accent-orange)" icon={<PawPrint size={15} />} />
            <StatTile value={overdue} label="Zaległe" color="var(--accent-red)" icon={<AlertCircle size={15} />} emphasized={overdue > 0} />
            <StatTile value={today} label="Dziś" color="var(--accent-amber)" icon={<Clock size={15} />} />
            <StatTile value={upcoming} label="Nadchodzące" color="var(--accent-blue)" icon={<CalendarDays size={15} />} href="/pets/calendar" />
          </div>
        )}

        {pets.length === 0 ? (
          <EmptyState
            icon={<PawPrint size={32} />}
            message="Nie masz jeszcze żadnych zwierząt"
            hint="Dodaj pierwsze zwierzę i wybierz pakiet funkcji dopasowany do tego, jak chcesz je prowadzić."
            cta={{ label: "Dodaj zwierzę", onClick: () => setShowForm(true), color: "var(--accent-orange)" }}
          />
        ) : (
          <>
            {(suggestions.length > 0 || activePets.length > 0) && (
              <div>
                <SectionHeading>Dobrostan</SectionHeading>
                <WelfareSuggestions
                  suggestions={suggestions}
                  pets={activePets.map((p) => ({ name: p.name, species: p.species, presetKey: p.presetKey }))}
                  agenda={agenda}
                />
              </div>
            )}

            <div>
              <SectionHeading>Kalendarz opieki</SectionHeading>
              <CareAgenda items={agenda} emptyHint="Zaplanuj leki, szczepienia lub rutyny w profilu zwierzęcia." />
            </div>

            <div>
              <SectionHeading>Moje zwierzęta</SectionHeading>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                {pets.map((pet) => <PetCard key={pet.id} pet={pet} />)}
              </div>
            </div>
          </>
        )}

        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderRadius: 8, border: "1px dashed var(--border)", background: "var(--bg-surface)",
          }}
        >
          <Sparkles size={14} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Użyj magicznej ikony (✨), aby tekstem lub głosem dodać zwierzę, zważyć je, zaplanować lek czy zapisać karmienie.
          </span>
        </div>
      </div>

      {showForm && <PetForm teams={teams} onClose={() => setShowForm(false)} />}
    </div>
  );
}
