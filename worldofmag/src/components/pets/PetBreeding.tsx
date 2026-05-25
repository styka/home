"use client";

import { useState, useEffect, useCallback, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Plus, Trash2, Loader2, Egg, Dna, GitBranch, Coins, Calculator } from "lucide-react";
import { Modal, Field, inputStyle, PrimaryButton, GhostButton } from "./Modal";
import { useToast } from "@/components/ui/Toast";
import {
  getPetBreeding, setParentage, setGenetics, createBreedingPair, updateBreedingPair,
  deleteBreedingPair, createClutch, markClutchHatched, deleteClutch, createOffspring,
  recordSale, deleteSale,
} from "@/actions/petBreeding";
import {
  parseGenetics, calculateOffspring, zygositiesForMode, GENE_MODE_LABELS, ZYGOSITY_LABELS,
  type PetGene, type GeneMode, type Zygosity,
} from "@/lib/petGenetics";
import { formatDate, speciesEmoji } from "@/lib/petSpecies";
import type { PetWithRelations, PetBreedingData } from "@/types";

const PAIR_STATUS: Record<string, string> = {
  PLANNED: "Planowana", PAIRED: "Połączona", COOLING: "Cooling", PRODUCTIVE: "Produktywna", RETIRED: "Wycofana",
};

function useBreeding(petId: string) {
  const [data, setData] = useState<PetBreedingData | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    getPetBreeding(petId).then((d) => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, [petId]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload };
}

function Title({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>{title}</h3>
      {action}
    </div>
  );
}
const addBtn = (onClick: () => void, label = "Dodaj") => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-orange)", background: "none", border: "none", cursor: "pointer" }}><Plus size={14} /> {label}</button>
);
const iconBtn: React.CSSProperties = { flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const card: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)" };

function Spinner() { return <div style={{ padding: 20, textAlign: "center" }}><Loader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} /></div>; }
function num(s: string): number | null { return s.trim() === "" ? null : parseFloat(s.replace(",", ".")); }
function int(s: string): number | null { return s.trim() === "" ? null : parseInt(s, 10); }

// ─── Genetyka ────────────────────────────────────────────────────────────────

export function GeneticsSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const { data, loading, reload } = useBreeding(pet.id);
  const [isPending, startTransition] = useTransition();
  const [gene, setGene] = useState("");
  const [mode, setMode] = useState<GeneMode>("recessive");
  const [zygosity, setZygosity] = useState<Zygosity>("het");
  const [partnerId, setPartnerId] = useState("");

  if (loading || !data) return <Spinner />;
  const genes = parseGenetics(data.genetics);

  function save(next: PetGene[]) {
    startTransition(async () => {
      try { await setGenetics(pet.id, next); reload(); showToast("Zapisano genetykę", "success"); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }
  function add() {
    if (!gene.trim()) { showToast("Podaj nazwę genu/morphu", "error"); return; }
    save([...genes, { gene: gene.trim(), mode, zygosity }]);
    setGene("");
  }

  const partner = data.candidates.find((c) => c.id === partnerId);
  const results = partner ? calculateOffspring(genes, parseGenetics(partner.genetics)) : [];
  const partnersWithGenes = data.candidates.filter((c) => parseGenetics(c.genetics).length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title title="Genotyp / morphy" />
        {genes.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Brak cech genetycznych. Dodaj geny/morphy, aby korzystać z kalkulatora par.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {genes.map((g, i) => (
              <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: 8 }}>
                <Dna size={14} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{g.gene}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ZYGOSITY_LABELS[g.zygosity]} · {GENE_MODE_LABELS[g.mode]}</span>
                <button onClick={() => save(genes.filter((_, idx) => idx !== i))} disabled={isPending} style={iconBtn}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label="Dodaj gen / morph"><input style={inputStyle} value={gene} onChange={(e) => setGene(e.target.value)} placeholder="np. Albino, Pastel" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Dziedziczenie">
              <select style={inputStyle} value={mode} onChange={(e) => { const m = e.target.value as GeneMode; setMode(m); setZygosity(zygositiesForMode(m)[1] ?? "het"); }}>
                {(Object.keys(GENE_MODE_LABELS) as GeneMode[]).map((m) => <option key={m} value={m}>{GENE_MODE_LABELS[m]}</option>)}
              </select>
            </Field>
            <Field label="Zygotyczność">
              <select style={inputStyle} value={zygosity} onChange={(e) => setZygosity(e.target.value as Zygosity)}>
                {zygositiesForMode(mode).map((z) => <option key={z} value={z}>{ZYGOSITY_LABELS[z]}</option>)}
              </select>
            </Field>
          </div>
          <PrimaryButton onClick={add} disabled={isPending}>Dodaj gen</PrimaryButton>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title title="Kalkulator pary" />
        {genes.length === 0 || partnersWithGenes.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Dodaj geny temu zwierzęciu oraz przynajmniej jednemu zwierzęciu tego samego gatunku, aby policzyć potomstwo.
          </p>
        ) : (
          <>
            <Field label="Partner">
              <select style={inputStyle} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">— wybierz —</option>
                {partnersWithGenes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            {partner && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Brak wspólnych/aktywnych genów do policzenia.</p> : results.map((r) => (
                  <div key={r.gene} style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Calculator size={13} style={{ color: "var(--accent-purple)" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.gene}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {GENE_MODE_LABELS[r.mode]}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {r.outcomes.map((o) => (
                        <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
                            <div style={{ width: `${o.pct}%`, height: "100%", background: "var(--accent-purple)" }} />
                          </div>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 120, flexShrink: 0 }}>{o.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", width: 48, textAlign: "right" }}>{o.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Hodowla ────────────────────────────────────────────────────────────────

export function BreedingSection({ pet }: { pet: PetWithRelations }) {
  const { showToast } = useToast();
  const { data, loading, reload } = useBreeding(pet.id);
  const [isPending, startTransition] = useTransition();
  const [pairOpen, setPairOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);

  if (loading || !data) return <Spinner />;

  function setParents(sireId: string | null, damId: string | null) {
    startTransition(async () => {
      try { await setParentage(pet.id, sireId, damId); reload(); showToast("Zapisano rodowód", "success"); }
      catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  const males = data.candidates.filter((c) => c.sex === "male");
  const females = data.candidates.filter((c) => c.sex === "female");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Rodowód */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title title="Rodowód" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Ojciec">
            <select style={inputStyle} value={data.sire?.id ?? ""} onChange={(e) => setParents(e.target.value || null, data.dam?.id ?? null)} disabled={isPending}>
              <option value="">— brak —</option>
              {males.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Matka">
            <select style={inputStyle} value={data.dam?.id ?? ""} onChange={(e) => setParents(data.sire?.id ?? null, e.target.value || null)} disabled={isPending}>
              <option value="">— brak —</option>
              {females.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        {data.offspring.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><GitBranch size={12} /> Potomstwo ({data.offspring.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.offspring.map((o) => (
                <Link key={o.id} href={`/pets/${o.id}`} style={{ fontSize: 12, color: "var(--accent-blue)", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px" }}>
                  {speciesEmoji(o.species ?? "other")} {o.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pary hodowlane */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title title="Pary hodowlane" action={addBtn(() => setPairOpen(true), "Nowa para")} />
        {data.pairs.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Brak par hodowlanych z udziałem tego zwierzęcia.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.pairs.map((p) => <PairCard key={p.id} pair={p} pet={pet} onChange={reload} />)}
          </div>
        )}
      </div>

      {/* Sprzedaż */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title title="Sprzedaż" action={addBtn(() => setSaleOpen(true), "Zapisz sprzedaż")} />
        {data.sales.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Brak rekordów sprzedaży.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.sales.map((s) => (
              <div key={s.id} style={{ ...card, display: "flex", alignItems: "center", gap: 8 }}>
                <Coins size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{s.buyerName || "Nabywca"}{s.price != null ? ` · ${s.price.toFixed(2)} ${s.currency}` : ""}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(s.soldAt)}{s.buyerContact ? ` · ${s.buyerContact}` : ""}</div>
                </div>
                <button onClick={() => startTransition(async () => { await deleteSale(s.id); reload(); })} style={iconBtn}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pairOpen && <PairModal pet={pet} candidates={data.candidates} onClose={() => setPairOpen(false)} onSaved={reload} />}
      {saleOpen && <SaleModal petId={pet.id} onClose={() => setSaleOpen(false)} onSaved={reload} />}
    </div>
  );
}

function PairCard({ pair, pet, onChange }: { pair: PetBreedingData["pairs"][number]; pet: PetWithRelations; onChange: () => void }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [clutchOpen, setClutchOpen] = useState(false);
  const [offspringOpen, setOffspringOpen] = useState(false);

  function changeStatus(status: string) {
    startTransition(async () => { await updateBreedingPair(pair.id, { status }); onChange(); });
  }
  function hatch(clutchId: string) {
    const n = prompt("Liczba wyklutych?");
    if (n == null) return;
    startTransition(async () => { await markClutchHatched(clutchId, parseInt(n, 10) || 0); onChange(); showToast("Oznaczono wyklucie", "success"); });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Egg size={14} style={{ color: "var(--accent-orange)", flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{pair.name}</span>
        <select value={pair.status} onChange={(e) => changeStatus(e.target.value)} disabled={isPending}
          style={{ fontSize: 11, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 6px" }}>
          {Object.keys(PAIR_STATUS).map((s) => <option key={s} value={s}>{PAIR_STATUS[s]}</option>)}
        </select>
        <button onClick={() => startTransition(async () => { if (confirm("Usunąć parę?")) { await deleteBreedingPair(pair.id); onChange(); } })} style={iconBtn}><Trash2 size={12} /></button>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
        ♂ {pair.male?.name ?? "—"} × ♀ {pair.female?.name ?? "—"}
      </div>

      {pair.clutches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
          {pair.clutches.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 8px", borderRadius: 6, background: "var(--bg-elevated)" }}>
              <span style={{ flex: 1, color: "var(--text-secondary)" }}>
                {c.laidAt ? formatDate(c.laidAt) : "klutch"} · {c.eggCount ?? "?"} jaj{c.fertileCount != null ? ` (${c.fertileCount} płodne)` : ""}
                {c.status === "HATCHED" ? ` · wyklute: ${c.hatchedCount ?? 0}` : c.expectedHatchAt ? ` · oczekiwane: ${formatDate(c.expectedHatchAt)}` : ""}
              </span>
              {c.status !== "HATCHED" && <button onClick={() => hatch(c.id)} style={{ fontSize: 11, color: "var(--accent-green)", background: "none", border: "none", cursor: "pointer" }}>wyklute</button>}
              <button onClick={() => startTransition(async () => { await deleteClutch(c.id); onChange(); })} style={iconBtn}><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setClutchOpen(true)} style={{ fontSize: 12, color: "var(--accent-orange)", background: "none", border: "none", cursor: "pointer" }}>+ Klutch / miot</button>
        <button onClick={() => setOffspringOpen(true)} style={{ fontSize: 12, color: "var(--accent-blue)", background: "none", border: "none", cursor: "pointer" }}>+ Potomek</button>
      </div>

      {clutchOpen && <ClutchModal pairId={pair.id} onClose={() => setClutchOpen(false)} onSaved={onChange} />}
      {offspringOpen && <OffspringModal pet={pet} pair={pair} onClose={() => setOffspringOpen(false)} onSaved={onChange} />}
    </div>
  );
}

function PairModal({ pet, candidates, onClose, onSaved }: { pet: PetWithRelations; candidates: PetBreedingData["candidates"]; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(`Para ${pet.name}`);
  const [partnerId, setPartnerId] = useState("");
  const partner = candidates.find((c) => c.id === partnerId);

  function create() {
    if (!name.trim()) { showToast("Podaj nazwę", "error"); return; }
    const maleId = pet.sex === "male" ? pet.id : partner?.sex === "male" ? partner.id : null;
    const femaleId = pet.sex === "female" ? pet.id : partner?.sex === "female" ? partner.id : null;
    startTransition(async () => {
      try {
        await createBreedingPair({ name: name.trim(), species: pet.species, maleId: maleId ?? (pet.sex !== "female" ? pet.id : null), femaleId: femaleId ?? (pet.sex === "female" ? pet.id : null) });
        onSaved(); onClose(); showToast("Utworzono parę", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <Modal title="Nowa para hodowlana" onClose={onClose} footer={<><GhostButton onClick={onClose}>Anuluj</GhostButton><PrimaryButton onClick={create} disabled={isPending}>Utwórz</PrimaryButton></>}>
      <Field label="Nazwa *"><input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Partner (ten sam gatunek)">
        <select style={inputStyle} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">— wybierz —</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.sex ? ` (${c.sex === "male" ? "♂" : c.sex === "female" ? "♀" : "?"})` : ""}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

function ClutchModal({ pairId, onClose, onSaved }: { pairId: string; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [laidAt, setLaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [eggCount, setEggCount] = useState("");
  const [fertileCount, setFertileCount] = useState("");
  const [tempC, setTempC] = useState("");
  const [humidity, setHumidity] = useState("");
  const [expected, setExpected] = useState("");

  function create() {
    startTransition(async () => {
      try {
        await createClutch(pairId, {
          laidAt: laidAt ? new Date(laidAt) : null, eggCount: int(eggCount), fertileCount: int(fertileCount),
          incubationTempC: num(tempC), humidityPct: num(humidity), expectedHatchAt: expected ? new Date(expected) : null,
        });
        onSaved(); onClose(); showToast("Dodano klutch", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <Modal title="Nowy klutch / miot" onClose={onClose} wide footer={<><GhostButton onClick={onClose}>Anuluj</GhostButton><PrimaryButton onClick={create} disabled={isPending}>Dodaj</PrimaryButton></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Data złożenia"><input type="date" style={inputStyle} value={laidAt} onChange={(e) => setLaidAt(e.target.value)} /></Field>
        <Field label="Oczekiwane wyklucie"><input type="date" style={inputStyle} value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
        <Field label="Liczba jaj"><input style={inputStyle} inputMode="numeric" value={eggCount} onChange={(e) => setEggCount(e.target.value)} /></Field>
        <Field label="Płodne"><input style={inputStyle} inputMode="numeric" value={fertileCount} onChange={(e) => setFertileCount(e.target.value)} /></Field>
        <Field label="Temp. inkubacji (°C)"><input style={inputStyle} inputMode="decimal" value={tempC} onChange={(e) => setTempC(e.target.value)} /></Field>
        <Field label="Wilgotność (%)"><input style={inputStyle} inputMode="decimal" value={humidity} onChange={(e) => setHumidity(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function OffspringModal({ pet, pair, onClose, onSaved }: { pet: PetWithRelations; pair: PetBreedingData["pairs"][number]; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [sex, setSex] = useState("unknown");

  function create() {
    if (!name.trim()) { showToast("Podaj imię", "error"); return; }
    startTransition(async () => {
      try {
        await createOffspring({ name: name.trim(), species: pet.species, sex, sireId: pair.male?.id ?? null, damId: pair.female?.id ?? null });
        onSaved(); onClose(); showToast("Dodano potomka", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <Modal title="Nowy potomek" onClose={onClose} footer={<><GhostButton onClick={onClose}>Anuluj</GhostButton><PrimaryButton onClick={create} disabled={isPending}>Dodaj</PrimaryButton></>}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Rodzice: ♂ {pair.male?.name ?? "—"} × ♀ {pair.female?.name ?? "—"}</p>
      <Field label="Imię *"><input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Płeć">
        <select style={inputStyle} value={sex} onChange={(e) => setSex(e.target.value)}>
          <option value="unknown">Nieznana</option><option value="male">Samiec</option><option value="female">Samica</option>
        </select>
      </Field>
    </Modal>
  );
}

function SaleModal({ petId, onClose, onSaved }: { petId: string; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [buyerName, setBuyerName] = useState("");
  const [buyerContact, setBuyerContact] = useState("");
  const [price, setPrice] = useState("");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));
  const [markSold, setMarkSold] = useState(true);

  function create() {
    startTransition(async () => {
      try {
        await recordSale(petId, { buyerName: buyerName.trim() || null, buyerContact: buyerContact.trim() || null, price: num(price), soldAt: soldAt ? new Date(soldAt) : undefined, markSold });
        onSaved(); onClose(); showToast("Zapisano sprzedaż", "success");
      } catch (e) { showToast(e instanceof Error ? e.message : "Błąd", "error"); }
    });
  }

  return (
    <Modal title="Zapisz sprzedaż" onClose={onClose} footer={<><GhostButton onClick={onClose}>Anuluj</GhostButton><PrimaryButton onClick={create} disabled={isPending}>Zapisz</PrimaryButton></>}>
      <Field label="Nabywca"><input autoFocus style={inputStyle} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} /></Field>
      <Field label="Kontakt"><input style={inputStyle} value={buyerContact} onChange={(e) => setBuyerContact(e.target.value)} placeholder="e-mail / telefon" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Cena (PLN)"><input style={inputStyle} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Data"><input type="date" style={inputStyle} value={soldAt} onChange={(e) => setSoldAt(e.target.value)} /></Field>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
        <input type="checkbox" checked={markSold} onChange={(e) => setMarkSold(e.target.checked)} /> Oznacz zwierzę jako sprzedane
      </label>
    </Modal>
  );
}
