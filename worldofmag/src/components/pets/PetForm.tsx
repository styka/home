"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Modal, Field, inputStyle, PrimaryButton, GhostButton } from "./Modal";
import { createPet, updatePet } from "@/actions/pets";
import { SPECIES_OPTIONS } from "@/lib/petSpecies";
import { PET_PRESETS, suggestedPresetForSpecies } from "@/lib/petPresets";
import { useToast } from "@/components/ui/Toast";
import type { Pet, PetSpecies } from "@/types";

interface PetFormProps {
  pet?: Pet;
  teams?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved?: (pet: Pet) => void;
}

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function PetForm({ pet, teams = [], onClose, onSaved }: PetFormProps) {
  const isEdit = !!pet;
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(pet?.name ?? "");
  const [species, setSpecies] = useState<PetSpecies>((pet?.species as PetSpecies) ?? "dog");
  const [breed, setBreed] = useState(pet?.breed ?? "");
  const [sex, setSex] = useState(pet?.sex ?? "unknown");
  const [birthDate, setBirthDate] = useState(toDateInput(pet?.birthDate));
  const [photoUrl, setPhotoUrl] = useState(pet?.photoUrl ?? "");
  const [notes, setNotes] = useState(pet?.notes ?? "");
  const [presetKey, setPresetKey] = useState(pet?.presetKey ?? suggestedPresetForSpecies("dog"));
  const [ownerTeamId, setOwnerTeamId] = useState(pet?.ownerTeamId ?? "");
  const [presetTouched, setPresetTouched] = useState(false);

  function onSpeciesChange(value: PetSpecies) {
    setSpecies(value);
    if (!isEdit && !presetTouched) setPresetKey(suggestedPresetForSpecies(value));
  }

  function handleSubmit() {
    if (!name.trim()) {
      showToast("Podaj imię zwierzęcia", "error");
      return;
    }
    startTransition(async () => {
      try {
        const common = {
          name: name.trim(),
          species,
          breed: breed.trim() || null,
          sex,
          birthDate: birthDate ? new Date(birthDate) : null,
          photoUrl: photoUrl.trim() || null,
          notes: notes.trim() || null,
        };
        let saved: Pet;
        if (isEdit && pet) {
          saved = await updatePet(pet.id, common);
        } else {
          saved = await createPet({
            ...common,
            presetKey,
            ownerTeamId: ownerTeamId || null,
          });
        }
        showToast(isEdit ? "Zapisano zmiany" : `Dodano ${saved.name}`, "success");
        onSaved?.(saved);
        onClose();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd zapisu", "error");
      }
    });
  }

  return (
    <Modal
      title={isEdit ? "Edytuj zwierzę" : "Nowe zwierzę"}
      onClose={onClose}
      wide
      footer={
        <>
          <GhostButton onClick={onClose}>Anuluj</GhostButton>
          <PrimaryButton onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 size={14} className="animate-spin" /> : isEdit ? "Zapisz" : "Dodaj"}
          </PrimaryButton>
        </>
      }
    >
      <Field label="Imię *">
        <input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Reksio" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Gatunek">
          <select style={inputStyle} value={species} onChange={(e) => onSpeciesChange(e.target.value as PetSpecies)}>
            {SPECIES_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Płeć">
          <select style={inputStyle} value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="unknown">Nieznana</option>
            <option value="male">Samiec</option>
            <option value="female">Samica</option>
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Rasa / morph">
          <input style={inputStyle} value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="np. golden retriever" />
        </Field>
        <Field label="Data urodzenia">
          <input type="date" style={inputStyle} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
      </div>

      <Field label="URL zdjęcia">
        <input style={inputStyle} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://… (wklej link do zdjęcia)" />
      </Field>

      <Field label="Notatki">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {!isEdit && (
        <>
          <Field label="Pakiet funkcji (preset)">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PET_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { setPresetKey(p.key); setPresetTouched(true); }}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${presetKey === p.key ? "var(--accent-orange)" : "var(--border)"}`,
                    background: presetKey === p.key ? "var(--bg-elevated)" : "var(--bg-surface)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.emoji} {p.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.description}</div>
                </button>
              ))}
            </div>
          </Field>

          {teams.length > 0 && (
            <Field label="Właściciel">
              <select style={inputStyle} value={ownerTeamId} onChange={(e) => setOwnerTeamId(e.target.value)}>
                <option value="">Ja (prywatne)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>Zespół: {t.name}</option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
    </Modal>
  );
}
