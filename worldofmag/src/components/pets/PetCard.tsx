"use client";

import Link from "next/link";
import { speciesEmoji, speciesLabel, ageFromBirth, STATUS_LABELS } from "@/lib/petSpecies";
import type { Pet } from "@/types";

export function PetCard({ pet, focused = false, onFocus }: { pet: Pet; focused?: boolean; onFocus?: () => void }) {
  const age = ageFromBirth(pet.birthDate);
  const isInactive = pet.status !== "ACTIVE";

  return (
    <Link
      href={`/pets/${pet.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${focused ? "var(--border-focus)" : "var(--border)"}`,
        background: focused ? "var(--bg-elevated)" : "var(--bg-surface)",
        textDecoration: "none",
        opacity: isInactive ? 0.6 : 1,
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={onFocus}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, overflow: "hidden",
        }}
      >
        {pet.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.photoUrl} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          speciesEmoji(pet.species)
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pet.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {speciesLabel(pet.species)}
          {pet.breed ? ` · ${pet.breed}` : ""}
          {age ? ` · ${age}` : ""}
        </div>
      </div>
      {isInactive && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{STATUS_LABELS[pet.status as keyof typeof STATUS_LABELS]}</span>
      )}
      {pet.ownerTeam && (
        <span style={{ fontSize: 10, color: "var(--accent-purple)", flexShrink: 0 }}>{pet.ownerTeam.name}</span>
      )}
    </Link>
  );
}
