"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, Cpu } from "lucide-react";
import {
  createProvider,
  updateProvider,
  deleteProvider,
  setAssignment,
  type ProviderDTO,
  type AssignmentDTO,
} from "@/actions/llmConfig";

const KIND_LABELS: Record<string, string> = {
  openai_compat: "OpenAI-compatible (Groq, OpenAI, xAI, OpenRouter…)",
  anthropic: "Anthropic (Claude)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 12,
      }}
    >
      {children}
    </h2>
  );
}

function ProviderEditor({ providers }: { providers: ProviderDTO[] }) {
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("openai_compat");
  const [baseUrl, setBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [apiKey, setApiKey] = useState("");

  function add() {
    if (!label.trim() || !baseUrl.trim()) return;
    startTransition(async () => {
      await createProvider({ label, kind, baseUrl, apiKey });
      setLabel("");
      setApiKey("");
      setAdding(false);
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>Dostawcy</SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {providers.map((p) => (
          <ProviderRow key={p.id} provider={p} />
        ))}
      </div>

      {adding ? (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--bg-surface)",
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <label style={labelStyle}>Nazwa</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="np. OpenAI" />
          </div>
          <div>
            <label style={labelStyle}>Rodzaj API</label>
            <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="openai_compat">{KIND_LABELS.openai_compat}</option>
              <option value="anthropic">{KIND_LABELS.anthropic}</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Adres bazowy (base URL)</label>
            <input
              style={inputStyle}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={kind === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.groq.com/openai/v1"}
            />
          </div>
          <div>
            <label style={labelStyle}>Klucz API (token)</label>
            <input style={inputStyle} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={add}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
              style={{ background: "var(--accent-blue)", color: "var(--on-accent)" }}
            >
              <Plus size={14} /> Dodaj
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-2 rounded text-sm"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm mt-3"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          <Plus size={14} /> Dodaj dostawcę
        </button>
      )}
    </section>
  );
}

function ProviderRow({ provider }: { provider: ProviderDTO }) {
  const [isPending, startTransition] = useTransition();
  const [editingKey, setEditingKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  function saveKey() {
    startTransition(async () => {
      await updateProvider(provider.id, { apiKey });
      setSaved(true);
      setEditingKey(false);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteProvider(provider.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Nie udało się usunąć");
      }
    });
  }

  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Cpu size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{provider.label}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {KIND_LABELS[provider.kind] ?? provider.kind} · {provider.baseUrl}
          </div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {saved ? "zapisano" : provider.hasKey ? provider.apiKeyMasked : "brak klucza"}
        </span>
        <button onClick={() => setEditingKey((v) => !v)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-secondary)" }}>
          Klucz
        </button>
        <button onClick={remove} disabled={isPending} className="p-1 rounded" style={{ color: "var(--accent-red)" }} title="Usuń">
          <Trash2 size={14} />
        </button>
      </div>
      {editingKey && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            style={inputStyle}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
            placeholder="Nowy klucz API"
            autoFocus
          />
          <button
            onClick={saveKey}
            disabled={isPending || !apiKey.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded text-sm disabled:opacity-40"
            style={{ background: "var(--accent-blue)", color: "var(--on-accent)" }}
          >
            <Check size={14} /> Zapisz
          </button>
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ assignment, providers }: { assignment: AssignmentDTO; providers: ProviderDTO[] }) {
  const [isPending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState(assignment.providerId ?? providers[0]?.id ?? "");
  const [model, setModel] = useState(assignment.model ?? assignment.defaultModel);
  const [saved, setSaved] = useState(false);

  function save() {
    if (!providerId || !model.trim()) return;
    startTransition(async () => {
      await setAssignment({ operationType: assignment.operationType, providerId, model });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>{assignment.label}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{assignment.description}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Dostawca</label>
          <select style={inputStyle} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {providers.length === 0 && <option value="">— brak dostawców —</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Model</label>
          <input style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)} placeholder={assignment.defaultModel} />
        </div>
        <button
          onClick={save}
          disabled={isPending || !providerId || !model.trim()}
          className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
          style={{ background: saved ? "var(--accent-green)" : "var(--accent-blue)", color: "var(--on-accent)", height: 35 }}
        >
          {saved ? <Check size={14} /> : null}
          {saved ? "Zapisano" : "Zapisz"}
        </button>
      </div>
    </div>
  );
}

export function LlmConfigPanel({
  providers,
  assignments,
}: {
  providers: ProviderDTO[];
  assignments: AssignmentDTO[];
}) {
  return (
    <div>
      <ProviderEditor providers={providers} />

      <section>
        <SectionTitle>Przypisanie modeli do typów operacji</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {assignments.map((a) => (
            <AssignmentRow key={a.operationType} assignment={a} providers={providers} />
          ))}
        </div>
      </section>
    </div>
  );
}
