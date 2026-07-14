"use client";

import { useState, useTransition } from "react";
import { Truck, MapPin, ExternalLink, Loader2, AlertTriangle, Save, Check, Info } from "lucide-react";
import { PageHeader, SectionHeading, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { saveVehicleProfile, planTruckRoute, type VehicleInput, type PlanResult } from "@/actions/truck";

const DEFAULTS: VehicleInput = { weight: 40, height: 4.0, length: 16.5, width: 2.55, axleload: 11.5 };

const FIELDS: { key: keyof VehicleInput; label: string; step: string }[] = [
  { key: "weight", label: "Waga (t)", step: "0.5" },
  { key: "height", label: "Wysokość (m)", step: "0.1" },
  { key: "length", label: "Długość (m)", step: "0.1" },
  { key: "width", label: "Szerokość (m)", step: "0.05" },
  { key: "axleload", label: "Nacisk na oś (t)", step: "0.5" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 14,
};

const cardBox: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--bg-surface)",
  padding: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginBottom: 4,
  display: "block",
};

export function TruckPlannerPage({ initialProfile }: { initialProfile: VehicleInput | null }) {
  const [form, setForm] = useState<Record<keyof VehicleInput, string>>(() => {
    const base = initialProfile ?? DEFAULTS;
    return {
      weight: String(base.weight),
      height: String(base.height),
      length: String(base.length),
      width: String(base.width),
      axleload: String(base.axleload),
    };
  });
  const [hasProfile, setHasProfile] = useState(initialProfile !== null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(false);
  const [savingPending, startSaving] = useTransition();
  const [planningPending, startPlanning] = useTransition();

  function toInput(): VehicleInput {
    return {
      weight: parseFloat(form.weight),
      height: parseFloat(form.height),
      length: parseFloat(form.length),
      width: parseFloat(form.width),
      axleload: parseFloat(form.axleload),
    };
  }

  function handleSaveProfile() {
    setError(null);
    startSaving(async () => {
      try {
        await saveVehicleProfile(toInput());
        setHasProfile(true);
        setSavedAt(true);
        setTimeout(() => setSavedAt(false), 2000);
      } catch {
        setError("Nie udało się zapisać profilu pojazdu.");
      }
    });
  }

  function handlePlan() {
    if (!origin.trim() || !destination.trim()) {
      setError("Podaj adres początkowy i docelowy.");
      return;
    }
    setError(null);
    setResult(null);
    startPlanning(async () => {
      const res = await planTruckRoute(origin, destination);
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res);
      }
    });
  }

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Truck size={22} />}
          iconColor="var(--accent-blue)"
          title="Trasy TIR"
          subtitle="Trasa dla ciężarówki omijająca ograniczenia wagi/wysokości i aktualne roboty drogowe, gotowa do otwarcia w Google Maps."
        />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--accent-amber)", background: "rgba(245,158,11,0.08)" }}>
          <AlertTriangle size={15} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Funkcja eksperymentalna.</strong> Trasy TIR są we wczesnej fazie — wynik z OpenRouteService bywa przybliżony i nie uwzględnia wszystkich ograniczeń. Zawsze zweryfikuj trasę przed wyjazdem.
          </span>
        </div>

        {/* Vehicle profile */}
        <div>
          <SectionHeading>Profil pojazdu</SectionHeading>
          <div style={cardBox}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: 10,
              }}
            >
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label style={labelStyle} htmlFor={`vp-${f.key}`}>
                    {f.label}
                  </label>
                  <input
                    id={`vp-${f.key}`}
                    type="number"
                    step={f.step}
                    min="0"
                    value={form[f.key]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingPending}
              style={{
                marginTop: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                cursor: savingPending ? "default" : "pointer",
              }}
            >
              {savingPending ? <Loader2 size={14} className="animate-spin" /> : savedAt ? <Check size={14} /> : <Save size={14} />}
              {savedAt ? "Zapisano" : "Zapisz profil"}
            </button>
          </div>
        </div>

        {/* Route form */}
        <div>
          <SectionHeading>Trasa</SectionHeading>
          <div style={cardBox}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelStyle} htmlFor="t-origin">Skąd</label>
                <input
                  id="t-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="np. Warszawa, Marszałkowska 1"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="t-dest">Dokąd</label>
                <input
                  id="t-dest"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="np. Kraków, Rynek Główny 1"
                  style={inputStyle}
                />
              </div>
            </div>
            <button
              onClick={handlePlan}
              disabled={planningPending}
              style={{
                marginTop: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                padding: "9px 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent-blue)",
                color: "var(--on-accent)",
                cursor: planningPending ? "default" : "pointer",
              }}
            >
              {planningPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              {planningPending ? "Liczę trasę…" : "Zaplanuj trasę"}
            </button>
            {!hasProfile && (
              <p style={{ fontSize: 11, color: "var(--accent-amber)", marginTop: 8, marginBottom: 0 }}>
                Najpierw zapisz profil pojazdu powyżej.
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              ...cardBox,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              borderColor: "var(--accent-red)",
            }}
          >
            <AlertTriangle size={16} style={{ color: "var(--accent-red)", flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <div>
            <SectionHeading>Wynik</SectionHeading>
            <div style={{ ...cardBox, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <div><strong style={{ color: "var(--text-secondary)" }}>Start:</strong> {result.origin.label}</div>
                <div><strong style={{ color: "var(--text-secondary)" }}>Cel:</strong> {result.destination.label}</div>
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Metric value={`${result.distanceKm} km`} label="dystans" />
                <Metric value={formatDuration(result.durationMin)} label="czas jazdy" />
                <Metric value={String(result.roadworksAvoided)} label="robót uwzględnionych" />
              </div>

              <a
                href={result.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "var(--accent-green)",
                  color: "var(--on-accent)",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={16} /> Otwórz w Google Maps
              </a>

              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Info size={13} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  Trasa zawiera do {result.waypoints.length} punktów pośrednich wyznaczających bezpieczny
                  korytarz. Google Maps może przeliczyć odcinki między nimi — przestrzeganie korytarza jest
                  przybliżone. Sama aplikacja Google Maps nie zna wymiarów Twojego pojazdu.
                </p>
              </div>

              {result.roadworks.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Roboty w korytarzu trasy
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {result.roadworks.map((rw, i) => (
                      <a
                        key={i}
                        href={rw.mapsPinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          padding: "6px 8px",
                          borderRadius: 6,
                          color: "var(--text-secondary)",
                          textDecoration: "none",
                          background: "var(--bg-base)",
                        }}
                      >
                        <MapPin size={13} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {rw.label}
                        </span>
                        <ExternalLink size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
