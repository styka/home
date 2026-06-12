// P3: eksport danych zwierzęcia dla weterynarza/kupującego.
// Bez zależności sieciowych: CSV pomiarów (download) + karta HTML do druku (→ PDF z przeglądarki).

import { speciesLabel, SEX_LABELS, STATUS_LABELS } from "@/lib/petSpecies";
import type { PetWithRelations, PetSex } from "@/types";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** CSV pomiarów (data, waga[g], długość[cm], BCS, notatka). */
export function buildMeasurementsCsv(pet: PetWithRelations): string {
  const head = ["Data", "Waga (g)", "Długość (cm)", "BCS (1-9)", "Notatka"];
  const rows = [...pet.measurements]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((m) => [
      fmtDate(m.date),
      m.weightGrams ?? "",
      m.lengthCm ?? "",
      m.bodyScore ?? "",
      (m.note ?? "").replace(/"/g, '""'),
    ]);
  const all = [head, ...rows];
  return all.map((r) => r.map((c) => `"${String(c)}"`).join(",")).join("\r\n");
}

/** Pełna karta zwierzęcia (HTML) do druku/zapisu jako PDF (window.print). */
export function buildVetCardHtml(pet: PetWithRelations): string {
  const sex = pet.sex && pet.sex !== "unknown" ? SEX_LABELS[pet.sex as PetSex] : "—";
  const profileRows: [string, string][] = [
    ["Gatunek", speciesLabel(pet.species)],
    ["Rasa / odmiana", pet.breed ?? "—"],
    ["Płeć", sex],
    ["Data urodzenia", pet.birthDate ? fmtDate(pet.birthDate) + (pet.birthApprox ? " (ok.)" : "") : "—"],
    ["Status", STATUS_LABELS[pet.status as keyof typeof STATUS_LABELS] ?? pet.status],
    ["Mikroczip", pet.microchipId ?? "—"],
    ["Identyfikator", pet.identifier ?? "—"],
    ["Umaszczenie", pet.color ?? "—"],
  ];

  const measurements = [...pet.measurements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 24);
  const treatments = [...pet.treatments].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const vetVisits = [...pet.vetVisits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const health = [...pet.healthRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const section = (title: string, body: string) => body ? `<h2>${esc(title)}</h2>${body}` : "";
  const table = (headers: string[], rows: string[][]) =>
    rows.length === 0 ? "" :
    `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  const kindLabel: Record<string, string> = { MEDICATION: "Lek", VACCINE: "Szczepionka", DEWORMER: "Odrobaczanie", PARASITE: "Przeciwpasożytniczy", SUPPLEMENT: "Suplement" };

  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>Karta zwierzęcia — ${esc(pet.name)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.5}
  h1{font-size:22px;margin:0 0 2px} h2{font-size:15px;margin:20px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
  .sub{color:#666;font-size:13px;margin:0 0 12px}
  table{border-collapse:collapse;width:100%;font-size:12px;margin:4px 0}
  th,td{border:1px solid #ddd;padding:4px 7px;text-align:left;vertical-align:top}
  th{background:#f4f4f4}
  .meta{font-size:11px;color:#888;margin-top:28px}
  @media print{ body{margin:0} button{display:none} }
</style></head><body>
<h1>${esc(pet.name)}</h1>
<p class="sub">${esc(speciesLabel(pet.species))}${pet.breed ? " · " + esc(pet.breed) : ""} · karta dla weterynarza</p>
${table(["Pole", "Wartość"], profileRows.map(([k, v]) => [k, v]))}
${section("Pomiary (ostatnie)", table(["Data", "Waga (g)", "Długość (cm)", "BCS", "Notatka"], measurements.map((m) => [fmtDate(m.date), String(m.weightGrams ?? "—"), String(m.lengthCm ?? "—"), String(m.bodyScore ?? "—"), m.note ?? ""])))}
${section("Leki i szczepienia", table(["Rodzaj", "Nazwa", "Dawka", "Od", "Do", "Aktywny"], treatments.map((t) => [kindLabel[t.kind] ?? t.kind, t.name, t.dosage ?? "—", fmtDate(t.startDate), t.endDate ? fmtDate(t.endDate) : "—", t.active ? "tak" : "nie"])))}
${section("Wizyty weterynaryjne", table(["Data", "Weterynarz / klinika", "Powód", "Diagnoza", "Koszt"], vetVisits.map((v) => [fmtDate(v.date), [v.vetName, v.clinic].filter(Boolean).join(", ") || "—", v.reason ?? "—", v.diagnosis ?? "—", v.cost != null ? String(v.cost) : "—"])))}
${section("Dziennik zdrowia", table(["Data", "Typ", "Tytuł", "Rozwiązane"], health.map((h) => [fmtDate(h.date), h.type, h.title, h.resolved ? "tak" : "nie"])))}
${pet.notes ? section("Notatki", `<p>${esc(pet.notes)}</p>`) : ""}
<p class="meta">Wygenerowano w Omnia · ${new Date().toLocaleString("pl-PL")}</p>
</body></html>`;
  return html;
}
